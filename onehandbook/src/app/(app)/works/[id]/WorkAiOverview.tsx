import Link from "next/link";
import type { AnalysisRunRow } from "@/lib/analysisSummary";

type EpisodeRow = {
  id: number;
  episode_number: number;
  title: string;
};

export function WorkAiOverview({
  workId,
  episodes,
  latestByEpisode,
  workAverage,
}: {
  workId: string;
  episodes: EpisodeRow[];
  latestByEpisode: Map<number, AnalysisRunRow>;
  workAverage: number | null;
}) {
  const analyzed = latestByEpisode.size;
  const total = episodes.length;

  return (
    <section className="mb-10 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">AI 분석</h2>
        <p className="mt-1 text-sm text-zinc-500">
          원고 읽기와 분리된 화면에서 회차를 골라 구간 점수를 볼 수 있습니다.
          목록은 <span className="text-zinc-400">1화부터</span> 오름차순입니다.
        </p>
        <p className="mt-2 text-xs font-medium text-zinc-500">
          🔒 원고는 분석 용도로만 사용되며, 다른 사람이 볼 수 없습니다
        </p>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <span className="text-zinc-400">
            작품 평균{" "}
            <span className="font-semibold text-amber-400">
              {workAverage != null ? `${workAverage}/100` : "—"}
            </span>
          </span>
          <span className="text-zinc-400">
            분석된 회차{" "}
            <span className="text-zinc-200">
              {analyzed} / {total}
            </span>
          </span>
        </div>
      </div>
      <Link
        href={`/works/${workId}/analysis`}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500"
      >
        AI 분석 열기
      </Link>
    </section>
  );
}
