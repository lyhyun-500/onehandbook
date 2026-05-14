import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import type {
  AnalysisRunRow,
  HolisticRunRow,
} from "@/lib/analysisSummary";
import { WorkAnalysisPage } from "./_components/WorkAnalysisPage";
import type { AnalysisTab } from "./_components/TabSegment";

type SearchParams = {
  tab?: string;
  run?: string;
  /** 기존 ?focus=<episodeId> 영역 호환 본질 — 본 sub-phase view-only 정합 영역 외 */
  focus?: string;
};

function resolveTab(tabParam: string | undefined): AnalysisTab {
  // LEE 결정 Z4 (a) — ?tab=individual|holistic. 기존 ?tab=batch 영역 = holistic 으로 정규화.
  if (tabParam === "holistic" || tabParam === "batch") return "holistic";
  return "individual";
}

export default async function WorkAnalysisRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { tab, run } = await searchParams;

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

  const natBalance = appUser.coin_balance ?? 0;
  const activeTab = resolveTab(tab);
  const currentRunId = run ?? null;

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
        episodes={episodes}
        runs={runs}
        holisticRuns={holisticRuns}
        activeTab={activeTab}
        currentRunId={currentRunId}
      />
    </>
  );
}
