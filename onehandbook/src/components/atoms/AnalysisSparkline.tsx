/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:76-100` 정합 — DimensionCard 안 mini chart.
 *
 * studio Sparkline (막대 그래프) 영역과 본질 다름 — LEE 결정 Z2 (b) 별 atom 신설.
 * SVG path + area fill + dots, 마지막 포인트 sky-400 + halo ring 강조.
 */
interface AnalysisSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** 마지막 dot 강조 (default true). */
  accentLast?: boolean;
}

function dotFill(score: number): string {
  // 시안 line 65-71 정합 (stone tone — score 단계에 따라 채도)
  if (score >= 88) return "oklch(0.74 0.005 270)";
  if (score >= 80) return "oklch(0.60 0.005 270)";
  if (score >= 72) return "oklch(0.48 0.005 270)";
  return "oklch(0.36 0.005 270)";
}

export function AnalysisSparkline({
  data,
  width = 140,
  height = 36,
  accentLast = true,
}: AnalysisSparklineProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data) - 4;
  const max = Math.max(...data) + 4;
  const range = Math.max(1, max - min);
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map<[number, number]>((v, i) => [
    i * stepX,
    height - ((v - min) / range) * height,
  ]);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${d} L${width.toFixed(1)},${height} L0,${height} Z`;
  const lastIdx = pts.length - 1;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden="true"
    >
      <path d={area} fill="oklch(0.55 0.005 270 / 0.10)" />
      <path
        d={d}
        fill="none"
        stroke="oklch(0.72 0.005 270)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) => {
        const isLast = i === lastIdx;
        const r = isLast ? 2.6 : 1.6;
        const fill =
          isLast && accentLast ? "oklch(0.78 0.13 240)" : dotFill(data[i]);
        return <circle key={i} cx={x} cy={y} r={r} fill={fill} />;
      })}
      {accentLast && (
        <circle
          cx={pts[lastIdx][0]}
          cy={pts[lastIdx][1]}
          r="5"
          fill="none"
          stroke="oklch(0.78 0.13 240 / 0.35)"
          strokeWidth="1"
        />
      )}
    </svg>
  );
}
