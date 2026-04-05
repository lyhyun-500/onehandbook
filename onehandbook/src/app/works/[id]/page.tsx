import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
import {
  averageOverallScore,
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import { EpisodeActions } from "./EpisodeActions";
import { EpisodeRowAnalysisBadge } from "@/components/EpisodeRowAnalysisBadge";
import { WorkAiOverview } from "./WorkAiOverview";

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  // 작품 조회 (본인 작품인지 확인)
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, author_id")
    .eq("id", id)
    .single();

  if (workError || !work || work.author_id !== appUser.id) {
    notFound();
  }

  // 회차 목록
  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, title, created_at")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at")
    .eq("work_id", id)
    .order("created_at", { ascending: false });

  const episodeList = episodes ?? [];
  const runs = (analysisRuns ?? []) as AnalysisRunRow[];
  const latestByEpisode = latestAnalysisPerEpisode(runs);
  const workAverage = averageOverallScore(latestByEpisode);
  const natBalance = appUser.nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={natBalance}
      />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← 대시보드로 돌아가기
        </Link>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{work.title}</h1>
            <p className="mt-1 text-zinc-400">
              {work.genre} · {work.total_episodes}화
            </p>
          </div>
          <Link
            href={`/works/${id}/settings`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            작품 설정
          </Link>
        </div>

        <WorkAiOverview
          workId={id}
          episodes={episodeList.map((e) => ({
            id: e.id,
            episode_number: e.episode_number,
            title: e.title,
          }))}
          latestByEpisode={latestByEpisode}
          workAverage={workAverage}
        />

        {/* 회차 목록 */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">회차 목록</h2>
            <Link
              href={`/works/${id}/episodes/new`}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
            >
              회차 등록
            </Link>
          </div>
          {episodeList.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="mb-4 text-zinc-500">등록된 회차가 없습니다</p>
              <Link
                href={`/works/${id}/episodes/new`}
                className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
              >
                회차 등록
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {episodeList.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-500">
                      {ep.episode_number}화
                    </span>
                    <span className="text-zinc-100">{ep.title}</span>
                    <EpisodeRowAnalysisBadge episodeId={ep.id} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500">
                      {new Date(ep.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    <EpisodeActions workId={id} episodeId={ep.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
