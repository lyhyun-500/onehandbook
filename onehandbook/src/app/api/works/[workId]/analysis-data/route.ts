import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import type { AnalysisRunRow, HolisticRunRow } from "@/lib/analysisSummary";
import { syncPerEpisodeAnalysisFromHolisticRun } from "@/lib/analysis/syncPerEpisodeAnalysisFromHolisticRun";
import { computeWorkAnalysisContextHash } from "@/lib/analysis/workAnalysisContextHash";
import type { HolisticAnalysisResult } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  const { workId } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select("id, author_id")
    .eq("id", workId)
    .single();

  if (!work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: episodesRaw } = await supabase
    .from("episodes")
    .select("id, episode_number, title")
    .eq("work_id", workId)
    .order("episode_number", { ascending: true });

  // DB 스키마가 오래된 환경에서는 analysis_runs.char_count 컬럼이 없을 수 있다.
  // 이 경우에도 runs 자체는 불러와야 하므로, char_count 포함 조회 실패 시 char_count 없이 재시도한다.
  const loadRuns = async (withCharCount: boolean) => {
    const sel = withCharCount
      ? "id, episode_id, agent_version, result_json, created_at, options_json, char_count"
      : "id, episode_id, agent_version, result_json, created_at, options_json";
    return await supabase
      .from("analysis_runs")
      .select(sel)
      .eq("work_id", workId)
      .order("created_at", { ascending: false })
      // 과거 회차가 많아져도 초기 로딩이 무거워지지 않도록 상한을 둔다.
      .limit(2000);
  };

  let analysisRuns: unknown[] | null = null;
  let runsErr: { message?: string } | null = null;
  {
    const first = await loadRuns(true);
    analysisRuns = (first.data as unknown[] | null) ?? null;
    runsErr = (first.error as { message?: string } | null) ?? null;
    if (
      runsErr?.message &&
      runsErr.message.includes("column analysis_runs.char_count does not exist")
    ) {
      const second = await loadRuns(false);
      analysisRuns = (second.data as unknown[] | null) ?? null;
      runsErr = (second.error as { message?: string } | null) ?? null;
    }
  }

  // Supabase가 bigint를 string으로 내려주는 경우가 있어 id/episode_id를 number로 정규화한다.
  let runs = (analysisRuns ?? [])
    .map((r) => {
      const id = Number((r as { id?: unknown }).id);
      const episode_id = Number((r as { episode_id?: unknown }).episode_id);
      if (!Number.isFinite(id) || !Number.isFinite(episode_id)) return null;
      return {
        ...(r as AnalysisRunRow),
        id,
        episode_id,
      } as AnalysisRunRow;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  console.info("[analysis-data] loaded", {
    workId,
    appUserId: appUser.id,
    episodes: (episodesRaw ?? []).length,
    runs: runs.length,
    runsErr: runsErr?.message ?? null,
  });

  const latestCharCountByEpisodeId = new Map<number, number>();
  for (const r of runs) {
    const epId = Number(r.episode_id);
    if (!Number.isFinite(epId)) continue;
    if (latestCharCountByEpisodeId.has(epId)) continue;
    const c = (r as unknown as { char_count?: number | null }).char_count;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      latestCharCountByEpisodeId.set(epId, c);
    }
  }

  const episodes = (episodesRaw ?? [])
    .map((e) => {
      const id = Number(e.id);
      const episode_number = Number(e.episode_number);
      if (!Number.isFinite(id) || !Number.isFinite(episode_number)) return null;
      return {
        id,
        episode_number,
        title: e.title,
        // 대량 content 로딩을 피하기 위해, 최근 분석의 char_count를 우선 사용.
        // 분석 이력이 없으면 패널 오픈 시 별도 endpoint로 계산한다.
        charCount: latestCharCountByEpisodeId.get(id) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const { data: holisticRows, error: holisticErr } = await supabase
    .from("holistic_analysis_runs")
    .select(
      "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at, options_json"
    )
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    .limit(40);

  const holisticHistory = !holisticErr
    ? ((holisticRows ?? []) as HolisticRunRow[])
    : [];

  const latestHolistic =
    holisticHistory.length > 0 ? holisticHistory[0]! : null;

  // 과거 single_call 통합 분석 등에서 회차별 run 동기화가 누락되면 UI가 계속 "통합 반영 전"으로 보일 수 있다.
  // 최신 통합 리포트 기준으로 회차별 최신 run이 스테일하면 best-effort로 동기화한다.
  let didAutoSync = false;
  try {
    if (latestHolistic && Array.isArray(latestHolistic.episode_ids)) {
      const holisticCreatedMs = new Date(latestHolistic.created_at).getTime();
      if (!Number.isNaN(holisticCreatedMs)) {
        const byEpisodeId = new Map<number, AnalysisRunRow>();
        for (const r of runs) {
          const eid = Number(r.episode_id);
          if (!Number.isFinite(eid) || byEpisodeId.has(eid)) continue;
          byEpisodeId.set(eid, r);
        }
        const targetEpisodeIds = latestHolistic.episode_ids
          .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isFinite(n) && n > 0);
        const staleAny = targetEpisodeIds.some((eid) => {
          const r = byEpisodeId.get(eid);
          if (!r) return true;
          const runMs = new Date(r.created_at).getTime();
          if (Number.isNaN(runMs)) return false;
          return runMs < holisticCreatedMs - 5000;
        });
        if (staleAny && targetEpisodeIds.length > 0 && targetEpisodeIds.length <= 50) {
          const { data: epsForSync } = await supabase
            .from("episodes")
            .select("id, episode_number, content")
            .in("id", targetEpisodeIds);
          const { data: workRow } = await supabase
            .from("works")
            .select("id, genre, title, world_setting, character_settings")
            .eq("id", workId)
            .maybeSingle();
          const optionsJson =
            (latestHolistic as unknown as { options_json?: Record<string, unknown> | null })
              .options_json ?? {};
          const includeLore = (optionsJson as { includeLore?: boolean }).includeLore !== false;
          const workContextHash = workRow
            ? computeWorkAnalysisContextHash(workRow, includeLore)
            : "";
          if (workContextHash) {
            await syncPerEpisodeAnalysisFromHolisticRun(supabase, {
              workId: Number(workId),
              holisticRunId: latestHolistic.id,
              agentVersion: latestHolistic.agent_version,
              holisticResult: latestHolistic.result_json as unknown as HolisticAnalysisResult,
              episodes: (epsForSync ?? []).map((e) => ({
                id: e.id,
                episode_number: e.episode_number,
                content: e.content ?? null,
              })),
              optionsJson,
              workContextHash,
            });
            didAutoSync = true;
          }
        }
      }
    }
  } catch {
    // best-effort only
  }

  // auto-sync가 수행됐다면, 이 응답에서도 즉시 반영되도록 runs/charCount를 재계산해 내려준다.
  if (didAutoSync) {
    const refetched = await loadRuns(!(runsErr?.message?.includes("char_count") ?? false));
    const analysisRuns2 = (refetched.data as unknown[] | null) ?? null;
    runs = (analysisRuns2 ?? [])
      .map((r) => {
        const id = Number((r as { id?: unknown }).id);
        const episode_id = Number((r as { episode_id?: unknown }).episode_id);
        if (!Number.isFinite(id) || !Number.isFinite(episode_id)) return null;
        return {
          ...(r as AnalysisRunRow),
          id,
          episode_id,
        } as AnalysisRunRow;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    console.info("[analysis-data] refetch after auto-sync", {
      workId,
      appUserId: appUser.id,
      runs: runs.length,
    });
  }

  return NextResponse.json({
    episodes,
    runs,
    latestHolistic,
    holisticHistory,
  });
}

