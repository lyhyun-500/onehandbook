import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
  type HolisticRunRow,
} from "@/lib/analysisSummary";
import type { WorkOption } from "@/components/atoms/WorkSelector";
import { WorkAnalysisPage } from "./_components/WorkAnalysisPage";
import type { AnalysisTab } from "./_components/TabSegment";
import type { HolisticTabMode } from "./_components/HolisticTab";

type SearchParams = {
  tab?: string;
  run?: string;
  /** holistic tab 의 select / report 모드 분기. */
  mode?: string;
  /** select 모드 진입 시 자동 선택 영역 ("missing" | "all"). */
  preselect?: string;
  /** 기존 ?focus=<episodeId> 호환 (현 sub-phase 영역 외). */
  focus?: string;
};

function resolveTab(tabParam: string | undefined): AnalysisTab {
  if (tabParam === "holistic" || tabParam === "batch") return "holistic";
  return "individual";
}

function resolveMode(modeParam: string | undefined): HolisticTabMode {
  if (modeParam === "select") return "select";
  return "report";
}

function resolvePreselect(
  preselectParam: string | undefined,
): "missing" | "all" | null {
  if (preselectParam === "missing") return "missing";
  if (preselectParam === "all") return "all";
  return null;
}

export default async function WorkAnalysisRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { tab, run, mode, preselect } = await searchParams;

  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, author_id, deleted_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const { data: episodesRaw } = await supabase
    .from("episodes")
    .select("id, episode_number, title")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });

  const episodes = (episodesRaw ?? []).map((e) => ({
    id: e.id as number,
    episode_number: e.episode_number as number,
    title: e.title as string,
  }));

  const { data: runsRaw } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at, options_json")
    .eq("work_id", id)
    .order("created_at", { ascending: false });
  const runs = (runsRaw ?? []) as AnalysisRunRow[];

  const { data: holisticRaw } = await supabase
    .from("holistic_analysis_runs")
    .select("id, work_id, episode_ids, agent_version, result_json, nat_cost, options_json, created_at")
    .eq("work_id", id)
    .order("created_at", { ascending: false });
  const holisticRuns = (holisticRaw ?? []) as HolisticRunRow[];

  // 작품 전환 WorkSelector 영역 — 사용자 본인의 작품 목록 전체.
  const { data: worksRaw } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes")
    .eq("author_id", appUser.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const workList = worksRaw ?? [];

  // 작품별 평균 점수 — runs 일괄 조회 후 derive.
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

  const natBalance = appUser.coin_balance ?? 0;
  const activeTab = resolveTab(tab);
  const currentRunId = run ?? null;
  const holisticMode = resolveMode(mode);
  const preselectMode = resolvePreselect(preselect);

  return (
    <>
      <TopBar
        breadcrumb={["스튜디오", work.title]}
        title="AI 분석 리포트"
        natBalance={natBalance}
      />

      <WorkAnalysisPage
        workId={id}
        work={{
          title: work.title as string,
          genre: work.genre as string,
          status: work.status as string,
          total_episodes: work.total_episodes as number,
        }}
        workOptions={workOptions}
        episodes={episodes}
        runs={runs}
        holisticRuns={holisticRuns}
        activeTab={activeTab}
        currentRunId={currentRunId}
        holisticMode={holisticMode}
        preselect={preselectMode}
        natBalance={natBalance}
      />
    </>
  );
}
