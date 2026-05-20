import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";
import {
  agentScoresByWorkFromRuns,
  averageOverallScore,
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import type { WorkOption } from "@/components/atoms/WorkSelector";
import { DeleteWorkButton } from "./DeleteWorkButton";
import { WorkDetailHeader } from "./WorkDetailHeader";
import { EpisodeRows } from "./EpisodeRows";
import {
  parseCharacterSettings,
  parseWorldSetting,
} from "@/components/side-panel/parseWorkJson";
import type { WorkNoteMemo } from "@/components/work/WorkNotesDrawer";
import type { BatchAnalyzeEpisode } from "@/components/work/BatchAnalyzeModal";
import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work, error: workError } = await supabase
    .from("works")
    .select(
      "id, title, genre, status, total_episodes, author_id, synopsis, world_setting, character_settings, deleted_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (workError || !work || work.author_id !== appUser.id) {
    notFound();
  }

  // content 까지 가져와서 4-stat 글자수 합산 (episodes.content_length 컬럼 부재).
  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content, created_at")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at")
    .eq("work_id", id)
    .order("created_at", { ascending: false });

  const episodeList = (episodes ?? []) as Array<{
    id: number;
    episode_number: number;
    title: string;
    content: string;
    created_at: string;
  }>;
  const runs = (analysisRuns ?? []) as AnalysisRunRow[];
  const latestByEpisode = latestAnalysisPerEpisode(runs);
  const workAverage = averageOverallScore(latestByEpisode);
  const natBalance = appUser.coin_balance ?? 0;

  const totalChars = episodeList.reduce(
    (sum, ep) => sum + (ep.content?.length ?? 0),
    0,
  );
  const totalEpisodesCount = episodeList.length;
  const analyzedCount = latestByEpisode.size;
  const avgChars =
    totalEpisodesCount > 0 ? Math.round(totalChars / totalEpisodesCount) : 0;

  // 작품 전환 WorkSelector — 사용자 본인 작품 전체.
  const { data: worksRaw } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes")
    .eq("author_id", appUser.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const workList = worksRaw ?? [];

  const workIds = workList.map((w) => w.id as number);
  let agentScores: Record<number, number | null> = {};
  if (workIds.length > 0) {
    const { data: allRuns } = await supabase
      .from("analysis_runs")
      .select("id, episode_id, work_id, agent_version, result_json, created_at")
      .in("work_id", workIds)
      .order("created_at", { ascending: false });
    const rowsTyped = (allRuns ?? []) as Array<
      AnalysisRunRow & { work_id: number }
    >;
    agentScores = agentScoresByWorkFromRuns(rowsTyped);
  }

  const workOptions: WorkOption[] = workList.map((w) => ({
    id: String(w.id),
    title: w.title as string,
    genre: w.genre as string,
    status: w.status as string,
    totalEpisodes: w.total_episodes as number,
    agentScore: agentScores[w.id as number] ?? null,
  }));

  // WorkNotesDrawer 데이터
  const worldSetting = parseWorldSetting(work.world_setting);
  const characterSettings = parseCharacterSettings(work.character_settings);

  let recentMemos: WorkNoteMemo[] = [];
  if (episodeList.length > 0) {
    const { data: memoRows } = await supabase
      .from("episode_memos")
      .select("episode_id, content, updated_at")
      .in(
        "episode_id",
        episodeList.map((e) => e.id),
      )
      .order("updated_at", { ascending: false })
      .limit(5);
    const epNumberById = new Map(
      episodeList.map((e) => [e.id, e.episode_number]),
    );
    recentMemos = (memoRows ?? [])
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({
        episodeNumber: epNumberById.get(m.episode_id) ?? 0,
        content: m.content as string,
        updatedAt: new Date(m.updated_at).toLocaleDateString("ko-KR"),
      }));
  }

  return (
    <>
      <TopBar
        breadcrumb={["스튜디오"]}
        title={work.title as string}
        natBalance={natBalance}
      />

      <main className="mx-auto max-w-5xl px-8 py-8">
        <Link
          href="/studio"
          className="mb-6 inline-block font-mono text-[10.5px] uppercase tracking-widest text-stone-400 hover:text-sky-200"
        >
          ← 스튜디오로 돌아가기
        </Link>

        <div className="flex items-start justify-between">
          <WorkDetailHeader
            workId={String(id)}
            works={workOptions}
            genre={work.genre as string}
            status={work.status as string}
            totalEpisodes={work.total_episodes as number}
            synopsis={
              typeof work.synopsis === "string" && work.synopsis.trim()
                ? (work.synopsis as string)
                : null
            }
            batchEpisodes={episodeList.map<BatchAnalyzeEpisode>((ep) => ({
              id: ep.id,
              episode_number: ep.episode_number,
              title: ep.title,
              charCount: ep.content?.length ?? 0,
              analyzed: latestByEpisode.has(ep.id),
            }))}
            natBalance={natBalance}
            agentVersion={ANALYSIS_PROFILES[0]?.id ?? "kakao-page"}
            worldSetting={worldSetting}
            characterSettings={characterSettings}
            recentMemos={recentMemos}
          />
          <DeleteWorkButton workId={Number(work.id)} />
        </div>

        {/* 4-stat 카드 — 시안 work.jsx WorkPage 정합 (WorkAiOverview 폐기). */}
        <div className="mb-6 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-stone-800/60 bg-stone-800/60">
          <StatCell
            label="전체 회차"
            value={totalEpisodesCount.toString()}
            sub="작성된 회차"
          />
          <StatCell
            label="총 글자수"
            value={totalChars.toLocaleString("ko-KR")}
            sub={
              totalEpisodesCount > 0
                ? `평균 ${avgChars.toLocaleString("ko-KR")}자`
                : "—"
            }
          />
          <StatCell
            label="분석"
            value={`${analyzedCount}/${totalEpisodesCount}`}
            sub="회차 분석율"
          />
          <Link
            href={`/works/${id}/analysis`}
            className="block bg-stone-950/60 px-5 py-4 transition-colors hover:bg-stone-900/60"
            aria-label="작품 분석 페이지로 이동"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              평균 점수
            </div>
            <div
              className={`mt-1.5 font-serif text-[26px] font-medium leading-none tabular-nums ${scoreTone(workAverage)}`}
            >
              {workAverage != null ? workAverage : "—"}
            </div>
            <div className="mt-1.5 text-[10.5px] text-stone-500">
              Agent Score · 분석 페이지로 →
            </div>
          </Link>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="font-serif text-[16px] font-medium text-stone-100">
                회차
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-stone-500">
                {totalEpisodesCount}편
              </span>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-widest text-stone-400 hover:text-stone-200"
            >
              최신순 <ChevronDown size={10} aria-hidden="true" />
            </button>
          </div>

          {episodeList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-700 bg-stone-900/30 px-8 py-14 text-center">
              <p className="font-serif text-[13px] text-stone-400">
                등록된 회차가 없습니다.
              </p>
              <Link
                href={`/works/${id}/episodes/new`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-stone-950 hover:bg-sky-400"
              >
                첫 회차 등록
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/20">
              <div className="grid grid-cols-[80px_1fr_90px_80px_70px_70px_40px] items-center gap-4 border-b border-stone-800/60 bg-stone-950/40 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-stone-500">
                <div>회차</div>
                <div>제목</div>
                <div className="text-right">글자수</div>
                <div className="text-right">점수</div>
                <div className="text-right">편집</div>
                <div className="text-right">분석</div>
                <div></div>
              </div>
              <EpisodeRows
                episodes={[...episodeList].reverse()}
                workId={String(id)}
                latestByEpisode={latestByEpisode}
              />
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-stone-950/60 px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[26px] font-medium leading-none tabular-nums text-stone-100">
        {value}
      </div>
      <div className="mt-1.5 text-[10.5px] text-stone-500">{sub}</div>
    </div>
  );
}

function scoreTone(score: number | null): string {
  if (score == null) return "text-stone-600";
  if (score >= 88) return "text-emerald-300";
  if (score >= 80) return "text-amber-200";
  if (score >= 72) return "text-amber-300/90";
  return "text-rose-300/80";
}
