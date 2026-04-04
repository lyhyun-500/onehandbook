import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { listAgentVersionsWithAvailability } from "@/lib/ai";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
import type { AnalysisRunRow, HolisticRunRow } from "@/lib/analysisSummary";
import { countManuscriptChars } from "@/lib/nat";
import { WorkAnalysisHub } from "./WorkAnalysisHub";

export default async function WorkAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { id } = await params;
  const { focus } = await searchParams;
  const focusId = focus ? parseInt(focus, 10) : undefined;
  const initialFocusEpisodeId =
    focusId != null && !Number.isNaN(focusId) ? focusId : undefined;

  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select("id, title, author_id")
    .eq("id", id)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const { data: episodesRaw } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });

  const episodes = (episodesRaw ?? []).map((e) => ({
    id: e.id,
    episode_number: e.episode_number,
    title: e.title,
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at")
    .eq("work_id", id)
    .order("created_at", { ascending: false });

  const runs = (analysisRuns ?? []) as AnalysisRunRow[];

  const { data: holisticRows, error: holisticErr } = await supabase
    .from("holistic_analysis_runs")
    .select(
      "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
    )
    .eq("work_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (holisticErr) {
    console.warn("holistic_analysis_runs 조회 실패(마이그레이션 미적용 가능):", holisticErr.message);
  }

  const latestHolistic = !holisticErr
    ? ((holisticRows?.[0] ?? null) as HolisticRunRow | null)
    : null;
  const versions = listAgentVersionsWithAvailability().map((v) => ({
    id: v.id,
    label: v.label,
    description: v.description,
    available: v.available,
  }));

  const natBalance = appUser.nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={natBalance}
      />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href={`/works/${id}`}
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← {work.title}으로 돌아가기
        </Link>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">AI 분석</h1>
            <p className="mt-1 text-zinc-400">{work.title}</p>
          </div>
          <Link
            href={`/works/${id}/settings`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-4 py-2.5 text-sm font-medium text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-950/50"
          >
            세계관 설정
          </Link>
        </div>

        <WorkAnalysisHub
          workId={id}
          workTitle={work.title}
          episodes={episodes}
          runs={runs}
          latestHolistic={latestHolistic}
          versions={versions}
          natBalance={natBalance}
          initialFocusEpisodeId={initialFocusEpisodeId}
          phoneVerified={appUser.phone_verified}
        />
      </main>
    </div>
  );
}
