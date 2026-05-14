/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:103-112` 정합 — DimensionCard 우상단 추세.
 *
 * delta > 0 = ▲ emerald-300, delta < 0 = ▼ rose-300, null/0 = — stone-500.
 */
interface TrendIndicatorProps {
  delta: number | null | undefined;
}

export function TrendIndicator({ delta }: TrendIndicatorProps) {
  if (delta == null || delta === 0) {
    return (
      <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
        —
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[10.5px] tabular-nums ${
        positive ? "text-emerald-300/85" : "text-rose-300/80"
      }`}
    >
      <span className="text-[9px]" aria-hidden="true">
        {positive ? "▲" : "▼"}
      </span>
      {Math.abs(delta)}
    </span>
  );
}
