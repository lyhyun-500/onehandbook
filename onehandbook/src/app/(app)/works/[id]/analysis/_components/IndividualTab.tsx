import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import {
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";
import { DimensionLocked } from "@/components/atoms/DimensionLocked";
import { ScoreRangeLegend } from "@/components/atoms/ScoreRangeLegend";
import { SourceBadge } from "@/components/atoms/SourceBadge";
import { DimensionCard, type DimensionSummary } from "./DimensionCard";

export interface EpisodeRef {
  id: number;
  episode_number: number;
  title: string;
}

interface IndividualTabProps {
  workId: string;
  workTitle: string;
  episodes: EpisodeRef[];
  runs: AnalysisRunRow[];
  /** 작품 평균 (분석 1+ 회차 시점). null = 분석 0건. */
  workAvgScore: number | null;
}

interface EpisodeRow {
  episodeId: number;
  episodeNumber: number;
  title: string;
  source: "individual" | "holistic";
  overall: number;
  dimensionScores: { key: string; label: string; score: number }[];
  analyzedAtIso: string;
}

const TOP_DIMENSION_KEYS_FALLBACK = [
  "hook_strength",
  "character_appeal",
  "worldbuilding",
  "tension",
  "romance_potential",
  "originality",
];

/**
 * runs 에서 6축 요약 derive.
 * 회차 오름차순으로 dimension 별 점수 시퀀스 + 평균 + 최신 코멘트.
 */
function deriveDimensionSummaries(
  runs: AnalysisRunRow[],
  episodes: EpisodeRef[],
): DimensionSummary[] {
  if (runs.length === 0) return [];

  const latest = latestAnalysisPerEpisode(runs);
  if (latest.size === 0) return [];

  // 회차 오름차순으로 latest run 순회
  const orderedRuns = episodes
    .map((e) => latest.get(e.id))
    .filter((r): r is AnalysisRunRow => r != null);
  if (orderedRuns.length === 0) return [];

  // 등장하는 dimension 키 (첫 latest run 기준 + fallback)
  const firstKeys = Object.keys(orderedRuns[0].result_json.dimensions ?? {});
  const dimensionKeys =
    firstKeys.length > 0 ? firstKeys : TOP_DIMENSION_KEYS_FALLBACK;

  return dimensionKeys.map((key) => {
    const scores: number[] = [];
    let latestComment = "";
    for (const run of orderedRuns) {
      const dim = run.result_json.dimensions?.[key];
      if (dim && typeof dim.score === "number") {
        scores.push(dim.score);
        latestComment = dim.comment ?? latestComment;
      }
    }
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
    return {
      key,
      label: formatDimensionLabel(key),
      avgScore,
      trendDelta: null, // Phase 2-D-8-3 view-only — 후속 sub-phase 에서 본질 계산
      sparkline: scores,
      summary: latestComment || "코멘트 부재",
    };
  });
}

function deriveEpisodeRows(
  runs: AnalysisRunRow[],
  episodes: EpisodeRef[],
): EpisodeRow[] {
  const latest = latestAnalysisPerEpisode(runs);
  return episodes
    .map((e) => {
      const run = latest.get(e.id);
      if (!run) return null;
      const dims = run.result_json.dimensions ?? {};
      const dimensionScores = Object.keys(dims).map((key) => ({
        key,
        label: formatDimensionLabel(key),
        score: dims[key]?.score ?? 0,
      }));
      const overall = run.result_json.overall_score;
      const source: "individual" | "holistic" =
        run.options_json && "synced_from_holistic_run_id" in run.options_json
          ? "holistic"
          : "individual";
      return {
        episodeId: e.id,
        episodeNumber: e.episode_number,
        title: e.title,
        source,
        overall,
        dimensionScores,
        analyzedAtIso: run.created_at,
      } satisfies EpisodeRow;
    })
    .filter((r): r is EpisodeRow => r != null);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx` 의 individual tab 본질 정합 — 6축 누적 + 회차표.
 */
export function IndividualTab({
  workId,
  workTitle,
  episodes,
  runs,
  workAvgScore,
}: IndividualTabProps) {
  const dimensions = deriveDimensionSummaries(runs, episodes);
  const episodeRows = deriveEpisodeRows(runs, episodes);
  const hasAnalyses = episodeRows.length > 0;

  if (episodes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-stone-700/70 bg-stone-900/30 px-8 py-14 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-800/60 text-stone-400">
          <FileText size={20} aria-hidden="true" />
        </div>
        <h3 className="font-serif text-[18px] text-stone-100">
          아직 회차가 없습니다
        </h3>
        <p className="mx-auto mt-2 max-w-md font-serif text-[13px] leading-relaxed text-stone-400">
          <span className="text-stone-200">{workTitle}</span>에 회차를 한 건이라도
          추가하시면 6축 통합 분석을 시작할 수 있어요.
        </p>
        <Link
          href={`/works/${workId}/episodes/new`}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-sky-400 px-4 py-2 text-[12.5px] font-medium text-stone-950 hover:bg-sky-300"
        >
          첫 회차 추가
        </Link>
      </div>
    );
  }

  return (
    <>
      <section>
        <header className="mb-5 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h2 className="font-serif text-[20px] text-stone-100">
              개별 분석 누적 점수
            </h2>
            <p className="mt-1 text-[12px] text-stone-500">
              개별 분석된 회차의 6축 평균
            </p>
          </div>
          {hasAnalyses && workAvgScore != null && (
            <div className="flex items-end gap-8">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
                  작품 평균
                </div>
                <div className="mt-1 flex items-baseline justify-end gap-1">
                  <span className="font-serif text-[40px] font-medium leading-none tabular-nums text-sky-300">
                    {workAvgScore}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-stone-500">
                    /100
                  </span>
                </div>
              </div>
              <div className="hidden self-end pb-1 md:block">
                <ScoreRangeLegend />
              </div>
            </div>
          )}
        </header>

        {!hasAnalyses ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOP_DIMENSION_KEYS_FALLBACK.map((key) => (
              <DimensionLocked key={key} label={formatDimensionLabel(key)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dimensions.map((d) => (
              <DimensionCard key={d.key} dim={d} />
            ))}
          </div>
        )}
      </section>

      {hasAnalyses && (
        <section className="mt-10">
          <header className="mb-3 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
                EPISODES
              </div>
              <h2 className="mt-0.5 font-serif text-[17px] text-stone-100">
                회차별 분석 결과
              </h2>
              <p className="mt-1 text-[11.5px] text-stone-500">
                개별 분석 우선, 없으면 일괄 derive — 출처 배지로 구분
              </p>
            </div>
            <div className="text-[11px] text-stone-500">
              <span className="tabular-nums">{episodeRows.length}</span>
              <span className="ml-1">회차 표시</span>
            </div>
          </header>

          <div className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/20">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stone-800/60 bg-stone-950/40">
                  <th className="py-3 pl-5 pr-3 text-left font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    회차
                  </th>
                  <th className="py-3 pr-3 text-left font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    제목
                  </th>
                  <th className="py-3 pr-3 text-left font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    출처
                  </th>
                  <th className="py-3 pr-3 text-right font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    평균
                  </th>
                  <th className="py-3 pr-5 text-right font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    분석 시점
                  </th>
                </tr>
              </thead>
              <tbody>
                {episodeRows.map((row) => (
                  <tr
                    key={row.episodeId}
                    className="group border-b border-stone-800/40 transition-colors hover:bg-stone-900/40"
                  >
                    <td className="py-3 pl-5 pr-3 align-middle">
                      <div className="font-mono text-[12px] tabular-nums text-stone-400">
                        {String(row.episodeNumber).padStart(2, "0")}화
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <Link
                        href={`/works/${workId}/episodes/${row.episodeId}`}
                        className="line-clamp-1 font-serif text-[13.5px] text-stone-100 hover:text-sky-200"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <SourceBadge source={row.source} />
                    </td>
                    <td
                      className={`py-3 pr-3 text-right align-middle font-serif text-[16px] font-medium tabular-nums ${getAnalysisScoreColor(row.overall)}`}
                    >
                      {row.overall}
                    </td>
                    <td className="py-3 pr-5 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5 text-[11px] text-stone-400">
                        <span className="tabular-nums">
                          {formatShortDate(row.analyzedAtIso)}
                        </span>
                        <ChevronRight
                          size={11}
                          aria-hidden="true"
                          className="text-stone-600 group-hover:text-sky-300"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-right text-[10.5px] text-stone-500">
            행을 클릭하면 회차 상세 분석 페이지로 이동합니다.
          </p>
        </section>
      )}
    </>
  );
}
