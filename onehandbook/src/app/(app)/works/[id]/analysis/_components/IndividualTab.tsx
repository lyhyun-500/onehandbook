"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import {
  latestAnalysisPerEpisode,
  type AnalysisRunRow,
} from "@/lib/analysisSummary";
import { formatDimensionLabel } from "@/lib/analysis/dimensionLabel";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { getAgentPlatformLabel } from "@/lib/agentPlatform";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";
import { EmptyState } from "@/components/atoms/EmptyState";
import { ScoreRangeLegend } from "@/components/atoms/ScoreRangeLegend";
import { SourceBadge } from "@/components/atoms/SourceBadge";
import { DimensionCard, type DimensionSummary } from "./DimensionCard";
import { type EpisodeScorePoint } from "./EpisodeTrendChart";

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
  /** 분석 시점 플랫폼 (agent_version 인코딩). 매핑 부재 = null → "—" 표시. */
  platform: string | null;
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

  // 회차 오름차순으로 latest run 순회 (회차번호 보존 — 펼침 차트용)
  const orderedRuns = episodes
    .map((e) => {
      const run = latest.get(e.id);
      return run ? { run, episodeNumber: e.episode_number } : null;
    })
    .filter(
      (x): x is { run: AnalysisRunRow; episodeNumber: number } => x != null,
    );
  if (orderedRuns.length === 0) return [];

  // 등장하는 dimension 키 (첫 latest run 기준 + fallback)
  const firstKeys = Object.keys(orderedRuns[0].run.result_json.dimensions ?? {});
  const dimensionKeys =
    firstKeys.length > 0 ? firstKeys : TOP_DIMENSION_KEYS_FALLBACK;

  return dimensionKeys.map((key) => {
    const trend: EpisodeScorePoint[] = [];
    let latestComment = "";
    for (const { run, episodeNumber } of orderedRuns) {
      const dim = run.result_json.dimensions?.[key];
      if (dim && typeof dim.score === "number") {
        trend.push({ episode_number: episodeNumber, score: dim.score });
        latestComment = dim.comment ?? latestComment;
      }
    }
    const scores = trend.map((t) => t.score);
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
      trend,
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
        platform: getAgentPlatformLabel(run.agent_version),
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
  const router = useRouter();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const dimensions = deriveDimensionSummaries(runs, episodes);
  const episodeRows = deriveEpisodeRows(runs, episodes);
  const hasAnalyses = episodeRows.length > 0;

  if (episodes.length === 0) {
    return (
      <EmptyState
        variant="stone"
        icon={<FileText size={20} aria-hidden="true" />}
        title="아직 회차가 없습니다"
        body={
          <>
            <span className="text-stone-200">{workTitle}</span>에 회차를 한
            건이라도 추가하시면 6축 통합 분석을 시작할 수 있어요.
          </>
        }
        cta={{
          label: "첫 회차 추가",
          href: `/works/${workId}/episodes/new`,
          variant: "primary",
        }}
      />
    );
  }

  if (!hasAnalyses) {
    return (
      <EmptyState
        variant="sky"
        icon={<FileText size={20} aria-hidden="true" />}
        title="아직 분석 이력이 없습니다"
        body={
          <>
            <span className="block">
              이 화면은 결과를 보는 곳입니다. 분석은 작품 상세에서 시작합니다.
            </span>
            <span className="mt-1 block">
              회차 행의 「분석」 버튼이나 「일괄 통합 분석」 으로 진입하세요.
            </span>
          </>
        }
        cta={{
          label: "분석하러 가기 →",
          href: `/works/${workId}`,
          variant: "primary",
        }}
      />
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dimensions.map((d) => (
            <DimensionCard
              key={d.key}
              dim={d}
              isExpanded={expandedKey === d.key}
              onToggle={() =>
                setExpandedKey((cur) => (cur === d.key ? null : d.key))
              }
            />
          ))}
        </div>
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
                  <th className="py-3 pr-3 text-left font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    플랫폼
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
                {episodeRows.map((row) => {
                  const goEpisode = () =>
                    router.push(
                      `/works/${workId}/episodes/${row.episodeId}`,
                    );
                  return (
                  <tr
                    key={row.episodeId}
                    role="button"
                    tabIndex={0}
                    onClick={goEpisode}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goEpisode();
                      }
                    }}
                    className="group cursor-pointer border-b border-stone-800/40 transition-colors hover:bg-stone-900/40 focus:bg-stone-900/40 focus:outline-none"
                  >
                    <td className="py-3 pl-5 pr-3 align-middle">
                      <div className="font-mono text-[12px] tabular-nums text-stone-400">
                        {formatEpisodeLabel(
                          { episode_number: row.episodeNumber, title: null },
                          { withTitle: false },
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <span className="line-clamp-1 font-serif text-[13.5px] text-stone-100 group-hover:text-sky-200">
                        {row.title}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <SourceBadge source={row.source} />
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <span
                        className={`text-[11.5px] ${row.platform ? "text-stone-300" : "text-stone-500"}`}
                      >
                        {row.platform ?? "—"}
                      </span>
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
                  );
                })}
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
