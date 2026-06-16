import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
import { countManuscriptChars } from "@/lib/nat";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import type { WorkOption } from "@/components/atoms/WorkSelector";
import type {
  EpisodeAnalysisStatus,
  EpisodeOption,
} from "@/components/atoms/EpisodeSelector";
import type {
  AnalysisRow,
  VersionOption,
} from "@/components/AnalyzePanel";
import type { HolisticLink } from "@/components/work/HolisticLinkBanner";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { EpisodeDetailClient } from "./_components/EpisodeDetailClient";
import {
  parseCharacterSettings,
  parseWorldSetting,
} from "@/components/side-panel/parseWorkJson";

export default async function EpisodeViewPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select(
      "id, title, genre, status, total_episodes, author_id, world_setting, character_settings, deleted_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const { data: episode } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content, created_at, episode_type")
    .eq("id", episodeId)
    .eq("work_id", id)
    .single();

  if (!episode) {
    notFound();
  }

  // 본 회차의 분석 이력
  const { data: runsRaw } = await supabase
    .from("analysis_runs")
    .select("id, agent_version, result_json, created_at, options_json")
    .eq("episode_id", episode.id)
    .order("created_at", { ascending: false });
  const initialAnalyses: AnalysisRow[] = (runsRaw ?? []).map((r) => ({
    id: r.id as number,
    agent_version: r.agent_version as string,
    result_json: r.result_json as AnalysisRow["result_json"],
    created_at: r.created_at as string,
    holistic_derived:
      typeof (r.options_json as { holistic_derived?: unknown })
        ?.holistic_derived === "boolean"
        ? ((r.options_json as { holistic_derived: boolean }).holistic_derived)
        : false,
  }));

  // 회차 전환 EpisodeSelector — 작품 내 전체 회차 + 분석 상태 derive
  const { data: allEpisodesRaw } = await supabase
    .from("episodes")
    .select("id, episode_number, title")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });
  const allEpisodes = allEpisodesRaw ?? [];
  const allEpisodeIds = allEpisodes.map((e) => e.id as number);

  const completedEpisodeIds = new Set<number>();
  const jobStatusByEpisode = new Map<number, "processing" | "failed">();
  if (allEpisodeIds.length > 0) {
    const { data: epRuns } = await supabase
      .from("analysis_runs")
      .select("episode_id")
      .in("episode_id", allEpisodeIds);
    for (const r of epRuns ?? []) {
      completedEpisodeIds.add(r.episode_id as number);
    }
    const { data: epJobs } = await supabase
      .from("analysis_jobs")
      .select("episode_id, status, updated_at")
      .in("episode_id", allEpisodeIds)
      .order("updated_at", { ascending: false });
    for (const j of epJobs ?? []) {
      const epId = j.episode_id as number;
      if (jobStatusByEpisode.has(epId)) continue;
      if (j.status === "pending" || j.status === "processing") {
        jobStatusByEpisode.set(epId, "processing");
      } else if (j.status === "failed") {
        jobStatusByEpisode.set(epId, "failed");
      }
    }
  }

  const episodeOptions: EpisodeOption[] = allEpisodes.map((e) => {
    const epId = e.id as number;
    const jobStatus = jobStatusByEpisode.get(epId);
    let status: EpisodeAnalysisStatus = "none";
    if (jobStatus === "processing") status = "processing";
    else if (completedEpisodeIds.has(epId)) status = "completed";
    else if (jobStatus === "failed") status = "failed";
    return {
      id: epId,
      episode_number: e.episode_number as number,
      title: e.title as string,
      analysis_status: status,
    };
  });

  // 작품 전환 WorkSelector — 사용자 본인의 작품 목록
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

  // 분석 프로필 옵션 — 서버 환경변수 기반 available 분기
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const versions: VersionOption[] = ANALYSIS_PROFILES.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    available: p.provider === "anthropic" ? hasAnthropic : false,
  }));

  const natBalance = appUser.coin_balance ?? 0;
  const phoneVerified = appUser.phone_verified;
  const charCount = countManuscriptChars(
    (episode.content as string | null) ?? "",
  );

  // HolisticLinkBanner: 본 회차가 속한 가장 최신 일괄 분석 1건 (LEE 결정 — N개 소속 시 최신 1건).
  const { data: holisticRunRow } = await supabase
    .from("holistic_analysis_runs")
    .select("id, episode_ids, result_json, created_at")
    .eq("work_id", id)
    .contains("episode_ids", [Number(episode.id)])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let holisticLink: HolisticLink | null = null;
  if (holisticRunRow) {
    const epIds = (holisticRunRow.episode_ids as number[]) ?? [];
    const epNums = epIds
      .map((eid) => allEpisodes.find((e) => e.id === eid)?.episode_number as number | undefined)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);
    const rangeLabel =
      epNums.length === 0
        ? `${epIds.length}회차`
        : epNums.length === 1
          ? `${epNums[0]}화`
          : `${epNums[0]}~${epNums[epNums.length - 1]}화`;
    const overall = (holisticRunRow.result_json as { overall_score?: unknown })?.overall_score;
    const runScore = typeof overall === "number" ? overall : null;
    const created = new Date(holisticRunRow.created_at as string);
    const runDate = `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, "0")}.${String(created.getDate()).padStart(2, "0")}`;
    holisticLink = {
      runId: String(holisticRunRow.id),
      workId: Number(id),
      episodeCount: epIds.length,
      rangeLabel,
      runScore,
      runDate,
    };
  }

  return (
    <>
      <TopBar
        breadcrumb={["스튜디오", work.title as string, "회차"]}
        title={formatEpisodeLabel({
          episode_number: episode.episode_number as number,
          title: episode.title as string,
        })}
        natBalance={natBalance}
      />

      <EpisodeDetailClient
        workId={Number(id)}
        workTitle={work.title as string}
        episodeId={episode.id as number}
        episodeNumber={episode.episode_number as number}
        episodeType={
          (episode.episode_type as "episode" | "prologue" | undefined) ??
          "episode"
        }
        episodeTitle={episode.title as string}
        body={(episode.content as string | null) ?? ""}
        charCount={charCount}
        workOptions={workOptions}
        episodeOptions={episodeOptions}
        versions={versions}
        initialAnalyses={initialAnalyses}
        natBalance={natBalance}
        phoneVerified={phoneVerified}
        holisticLink={holisticLink}
        worldSetting={parseWorldSetting(work.world_setting)}
        characterSettings={parseCharacterSettings(work.character_settings)}
      />
    </>
  );
}
