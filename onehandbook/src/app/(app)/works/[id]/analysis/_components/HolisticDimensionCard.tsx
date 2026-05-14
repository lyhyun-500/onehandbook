import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";

export interface HolisticDimension {
  key: string;
  label: string;
  score: number;
  comment: string;
}

interface HolisticDimensionCardProps {
  dim: HolisticDimension;
}

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx:226-238` 정합 — 일괄 분석 dimensions 카드.
 *
 * DimensionCard 와 외형 일관 (border + bg + p-5) — Sparkline/Trend 부재.
 * LEE 결정 Z6 — holistic-report.jsx 시안 5단계 영역 → 4단계 통합 (getAnalysisScoreColor 정합).
 */
export function HolisticDimensionCard({ dim }: HolisticDimensionCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/60 p-5 transition-all hover:ring-1 hover:ring-stone-700/60">
      <header className="flex items-start justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">{dim.label}</h3>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-stone-600">
          /100
        </span>
      </header>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-serif text-[40px] font-medium leading-none tabular-nums ${getAnalysisScoreColor(dim.score)}`}
        >
          {dim.score}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-stone-600">
          /100
        </span>
      </div>
      <p className="font-serif text-[12.5px] leading-relaxed text-stone-300">
        {dim.comment}
      </p>
    </article>
  );
}
