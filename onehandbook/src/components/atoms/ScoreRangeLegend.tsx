/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:115-122` 정합 — 4단계 chip legend.
 *
 * 분석 영역 한정 (LEE 결정 Z1 / Z6 정합). 4단계 임계 = 88+ / 80-87 / 72-79 / ~71.
 */
export function ScoreRangeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-stone-500">
      <span className="flex items-center gap-1">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
        88+
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-amber-200"
        />
        80–87
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-amber-300/80"
        />
        72–79
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-rose-300/70"
        />
        ~71
      </span>
    </div>
  );
}
