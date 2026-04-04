import Link from "next/link";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { createClient } from "@/lib/supabase/server";
import {
  agentScoresByWorkFromRuns,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";

const STATUS_LABEL: Record<string, string> = {
  연재중: "연재중",
  완결: "완결",
  휴재: "휴재",
};

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: works } = await supabase
    .from("works")
    .select("id, title, genre, status, total_episodes, created_at")
    .order("created_at", { ascending: false });

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, work_id, agent_version, result_json, created_at");

  const runs = (analysisRuns ?? []) as Array<
    AnalysisRunRow & { work_id: number }
  >;
  const agentScores = agentScoresByWorkFromRuns(runs);

  const sortKey = (workId: number) => agentScores[workId] ?? -1;

  const sorted = [...(works ?? [])].sort(
    (a, b) => sortKey(b.id) - sortKey(a.id)
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
        공개 매대
      </p>
      <h1 className="text-2xl font-bold text-zinc-100">작품 탐색</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
        <CopyWithBreaks as="span" className="block">
          Agent Score는 작품마다 분석이 있는 회차의 종합 점수 평균입니다. 분석이 없으면 표시가 없습니다. 카드를 눌러 회차를 읽을 수 있습니다.
        </CopyWithBreaks>
      </p>

      {!sorted.length ? (
        <div className="mt-10 rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-12 text-center text-zinc-400 shadow-lg shadow-black/20">
          아직 등록된 작품이 없습니다
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {sorted.map((work) => (
            <Link
              key={work.id}
              href={`/explore/${work.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-5 shadow-md shadow-black/10 transition-colors hover:border-cyan-500/25 hover:bg-zinc-900/70 sm:p-6"
            >
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-zinc-100">
                  {work.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                  <span>{work.genre}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{STATUS_LABEL[work.status] ?? work.status}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{work.total_episodes}화</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/80">
                  Agent Score
                </p>
                {agentScores[work.id] != null ? (
                  <>
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        agentScores[work.id]! >= 70
                          ? "text-cyan-300"
                          : agentScores[work.id]! >= 40
                            ? "text-amber-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {agentScores[work.id]}
                    </p>
                    <p className="text-xs text-zinc-500">/ 100</p>
                  </>
                ) : (
                  <p className="text-lg font-medium text-zinc-600">—</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
