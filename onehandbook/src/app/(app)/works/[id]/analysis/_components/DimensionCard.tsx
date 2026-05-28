import { ChevronDown } from "lucide-react";
import { AnalysisSparkline } from "@/components/atoms/AnalysisSparkline";
import { TrendIndicator } from "@/components/atoms/TrendIndicator";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";
import { EpisodeTrendChart, type EpisodeScorePoint } from "./EpisodeTrendChart";

export interface DimensionSummary {
  key: string;
  label: string;
  avgScore: number;
  trendDelta: number | null;
  sparkline: number[];
  /** 펼침 상태 EpisodeTrendChart 용 — 회차번호+점수 쌍. */
  trend: EpisodeScorePoint[];
  summary: string;
}

interface DimensionCardProps {
  dim: DimensionSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:125-144` 정합 — 6축 누적 점수 카드.
 *
 * 접힘: header(label + trend + chevron) / score + AnalysisSparkline / summary line-clamp-2.
 * 펼침(isExpanded): col-span-full + EpisodeTrendChart + summary 전체.
 * Tailwind v4 `hover:` 는 기본 `@media (hover: hover)` 범위 — 터치 sticky hover 자동 방지.
 */
export function DimensionCard({ dim, isExpanded, onToggle }: DimensionCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`group flex cursor-pointer flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/60 p-5 transition-all hover:ring-1 hover:ring-stone-700/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-600 ${isExpanded ? "col-span-full" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-[14px] text-stone-300">{dim.label}</h3>
        <div className="flex items-center gap-2">
          <TrendIndicator delta={dim.trendDelta} />
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-stone-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-serif text-[40px] font-medium leading-none tabular-nums ${getAnalysisScoreColor(dim.avgScore)}`}
          >
            {dim.avgScore}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-stone-600">
            /100
          </span>
        </div>
        {!isExpanded && (
          <div className="opacity-90 group-hover:opacity-100">
            <AnalysisSparkline data={dim.sparkline} width={140} height={36} />
          </div>
        )}
      </div>

      {isExpanded && dim.trend.length > 0 && (
        <div className="mt-1 w-full">
          <EpisodeTrendChart data={dim.trend} />
        </div>
      )}

      <p
        className={`font-serif text-[12.5px] leading-relaxed text-stone-400 ${isExpanded ? "" : "line-clamp-2"}`}
      >
        {dim.summary}
      </p>
    </article>
  );
}
