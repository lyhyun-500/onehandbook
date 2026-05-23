import { AnalysisSparkline } from "@/components/atoms/AnalysisSparkline";
import { TrendIndicator } from "@/components/atoms/TrendIndicator";
import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";

export interface DimensionSummary {
  key: string;
  label: string;
  avgScore: number;
  trendDelta: number | null;
  sparkline: number[];
  summary: string;
}

interface DimensionCardProps {
  dim: DimensionSummary;
}

/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:125-144` 정합 — 6축 누적 점수 카드.
 *
 * header (label + TrendIndicator) / score + AnalysisSparkline / summary line-clamp-2.
 */
export function DimensionCard({ dim }: DimensionCardProps) {
  return (
    <article className="group flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/60 p-5 transition-all hover:ring-1 hover:ring-stone-700/60">
      <header className="flex items-start justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">{dim.label}</h3>
        <TrendIndicator delta={dim.trendDelta} />
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
        <div className="opacity-90 group-hover:opacity-100">
          <AnalysisSparkline data={dim.sparkline} width={140} height={36} />
        </div>
      </div>

      <p className="line-clamp-2 font-serif text-[12.5px] leading-relaxed text-stone-400">
        {dim.summary}
      </p>
    </article>
  );
}
