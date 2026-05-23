import { type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { LeftRail, type LeftRailWork } from "@/components/shell/LeftRail";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";

const RECENT_WORKS_LIMIT = 4;
/** 시안 hardcoded "작가님" 정합 — 베타 기간 사용자 명시 정책. */
const DISPLAY_NAME = "작가님";

type WorkRow = {
  id: number;
  title: string;
  genre: string;
  status: string;
  total_episodes: number;
  created_at: string;
};

/**
 * 옵션 C 정책 — analysis_runs 최신 DISTINCT work_id 우선,
 * 부족하면 works.created_at DESC 보충. 최종 RECENT_WORKS_LIMIT 건.
 *
 * fallbackId = 최근 분석 작품 1번째. 분석 0 사용자는 가장 최근 생성 작품. 작품 0건이면 null.
 * episodeFallback = 작품별 최근 analysis_run 의 episode_id. URL 부재 시 회차 분석 메뉴 진입 본질.
 */
function computeLeftRailData(
  works: WorkRow[],
  runs: Array<AnalysisRunRow & { work_id: number }>,
): {
  recent: LeftRailWork[];
  fallbackId: number | null;
  episodeFallback: Record<number, number>;
} {
  const worksById = new Map<number, WorkRow>();
  for (const w of works) worksById.set(w.id, w);

  const scoreMap = agentScoresByWorkFromRuns(runs);

  // analysis_runs.created_at DESC 순서로 DISTINCT work_id.
  const seenWorkIds = new Set<number>();
  const orderedByAnalysis: number[] = [];
  for (const r of runs) {
    const wid = r.work_id;
    if (seenWorkIds.has(wid)) continue;
    if (!worksById.has(wid)) continue;
    seenWorkIds.add(wid);
    orderedByAnalysis.push(wid);
  }

  // works.created_at DESC 보충 (works 자체가 이미 정렬된 상태로 주어진다고 가정).
  const orderedIds = [...orderedByAnalysis];
  for (const w of works) {
    if (orderedIds.length >= RECENT_WORKS_LIMIT) break;
    if (seenWorkIds.has(w.id)) continue;
    orderedIds.push(w.id);
    seenWorkIds.add(w.id);
  }

  const recent: LeftRailWork[] = orderedIds
    .slice(0, RECENT_WORKS_LIMIT)
    .map((id) => {
      const w = worksById.get(id)!;
      return {
        id: w.id,
        title: w.title,
        genre: w.genre,
        totalEpisodes: w.total_episodes,
        agentScore: scoreMap[w.id] ?? null,
      };
    });

  const fallbackId =
    orderedByAnalysis[0] ?? works[0]?.id ?? null;

  // runs 는 이미 created_at DESC 정렬 — 작품별 최초 등장이 최신.
  const episodeFallback: Record<number, number> = {};
  for (const r of runs) {
    if (episodeFallback[r.work_id] != null) continue;
    if (!worksById.has(r.work_id)) continue;
    const eid = Number(
      (r as unknown as { episode_id?: unknown }).episode_id ?? Number.NaN,
    );
    if (!Number.isFinite(eid)) continue;
    episodeFallback[r.work_id] = eid;
  }

  return { recent, fallbackId, episodeFallback };
}

/**
 * `(app)` route group layout — Phase 2-D-8-1 시점에는 그룹 안 페이지 0건이라
 * 적용 영역 자체가 없음 (인프라 신설). 페이지 이동은 2-D-8-2 영역.
 *
 * 인증 가드: requireAppUser 가 미인증 시 /login redirect.
 * 페이지 측 requireAppUser 호출은 LEE 결정 (함정 3 / 옵션 1) — 유지.
 */
export default async function AppShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);
  const userId = appUser.id;

  const { data: worksData } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, created_at")
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const works = (worksData ?? []) as WorkRow[];
  const workIds = works.map((w) => w.id);

  let analysisRuns: Array<AnalysisRunRow & { work_id: number }> = [];
  if (workIds.length > 0) {
    const { data } = await supabase
      .from("analysis_runs")
      .select("id, episode_id, work_id, agent_version, result_json, created_at")
      .in("work_id", workIds)
      .order("created_at", { ascending: false });
    analysisRuns = (data ?? []) as Array<AnalysisRunRow & { work_id: number }>;
  }

  const { recent, fallbackId, episodeFallback } = computeLeftRailData(
    works,
    analysisRuns,
  );
  const natBalance = appUser.coin_balance ?? 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
      <LeftRail
        displayName={DISPLAY_NAME}
        natBalance={natBalance}
        recentWorks={recent}
        currentWorkFallbackId={fallbackId}
        currentEpisodeFallbackByWorkId={episodeFallback}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
