import Link from "next/link";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  agentScoreFromAnalysisRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";

const STATUS_LABEL: Record<string, string> = {
  연재중: "연재중",
  완결: "완결",
  휴재: "휴재",
};

export default async function ExploreWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: work, error } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes")
    .eq("id", id)
    .single();

  if (error || !work) {
    notFound();
  }

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, title, created_at")
    .eq("work_id", id)
    .order("episode_number", { ascending: true });

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at")
    .eq("work_id", work.id)
    .order("created_at", { ascending: false });

  const runs = (analysisRuns ?? []) as AnalysisRunRow[];
  const score = agentScoreFromAnalysisRuns(runs);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <Link
        href="/explore"
        className="mb-8 inline-flex items-center gap-1 text-sm text-cyan-400/90 transition-colors hover:text-cyan-300"
      >
        ← 탐색으로
      </Link>

      <div className="mb-10 flex flex-col gap-6 rounded-xl border border-cyan-500/10 bg-zinc-900/40 p-6 shadow-lg shadow-black/20 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/85">
            작품
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">{work.title}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {work.genre} · {STATUS_LABEL[work.status] ?? work.status} ·{" "}
            {work.total_episodes}화
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-5 py-4 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/80">
            Agent Score
          </p>
          {score != null ? (
            <>
              <p
                className={`text-3xl font-bold tabular-nums ${
                  score >= 70
                    ? "text-cyan-300"
                    : score >= 40
                      ? "text-amber-400"
                      : "text-zinc-500"
                }`}
              >
                {score}
              </p>
              <p className="text-xs text-zinc-500">/ 100</p>
            </>
          ) : (
            <p className="text-xl font-medium text-zinc-600">—</p>
          )}
          <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-zinc-500">
            분석 기록이 있는 회차 종합 점수 평균
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">회차 목록</h2>
        <p className="mb-4 text-sm text-zinc-500">
          <CopyWithBreaks as="span" className="block">
            위 Agent Score는 이 작품에서 AI 분석이 한 번이라도 저장된 회차만 모아 종합 점수를 평균한 값입니다. 목록은 1화부터 오름차순입니다.
          </CopyWithBreaks>
        </p>
        {!episodes?.length ? (
          <div className="rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-8 text-center text-zinc-500 shadow-md shadow-black/10">
            등록된 회차가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/explore/${id}/episodes/${ep.id}`}
                className="flex flex-col gap-2 rounded-xl border border-cyan-500/10 bg-zinc-900/50 px-4 py-3 transition-colors hover:border-cyan-500/25 hover:bg-zinc-900/70 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <span className="text-sm tabular-nums text-cyan-400/90">
                    {ep.episode_number}화
                  </span>
                  <span className="ml-3 text-zinc-100">{ep.title}</span>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(ep.created_at).toLocaleDateString("ko-KR")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
