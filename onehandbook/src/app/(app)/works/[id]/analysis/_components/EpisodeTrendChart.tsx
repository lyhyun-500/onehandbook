export interface EpisodeScorePoint {
  episode_number: number;
  score: number;
}

interface EpisodeTrendChartProps {
  data: EpisodeScorePoint[];
  width?: number;
  height?: number;
}

/**
 * 시안 `design_novel/novel-agent/holistic-report.jsx:128-193` 정합 — 일괄 회차별 점수 line chart.
 *
 * 자체 SVG (외부 chart 라이브러리 부재 — 호스트 페이지 경량 본질).
 * y-axis = 3-unit step nice bounds, x-axis = 회차 번호, line = sky-400, dots = hollow ring.
 */
export function EpisodeTrendChart({
  data,
  width = 880,
  height = 280,
}: EpisodeTrendChartProps) {
  if (!data || data.length === 0) return null;

  const padL = 56;
  const padR = 24;
  const padT = 20;
  const padB = 44;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const scores = data.map((d) => d.score);
  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);

  // 3-unit nice bounds with ~4-unit padding (시안 line 141-142 정합)
  const niceMin = Math.max(0, Math.floor((dataMin - 4) / 3) * 3);
  const niceMax = Math.min(100, Math.ceil((dataMax + 4) / 3) * 3);
  const range = Math.max(1, niceMax - niceMin);

  const ticks: number[] = [];
  const tickStep = Math.ceil(range / 4 / 3) * 3 || 3;
  for (let v = niceMin; v <= niceMax + 0.01; v += tickStep) {
    ticks.push(Math.round(v));
  }

  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const pts: [number, number][] = data.map((d, i) => [
    padL + i * stepX,
    padT + plotH - ((d.score - niceMin) / range) * plotH,
  ]);

  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      className="block"
      aria-label={`회차별 점수 추이 — ${data.length}회차`}
    >
      {/* y-axis gridlines + labels */}
      {ticks.map((t) => {
        const y = padT + plotH - ((t - niceMin) / range) * plotH;
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="oklch(0.30 0.005 270)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text
              x={padL - 12}
              y={y}
              dy="0.32em"
              textAnchor="end"
              fill="oklch(0.55 0.005 270)"
              fontSize="11"
              fontFamily="ui-monospace, monospace"
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* x-axis labels */}
      {pts.map(([x], i) => (
        <text
          key={i}
          x={x}
          y={height - padB + 22}
          textAnchor="middle"
          fill="oklch(0.55 0.005 270)"
          fontSize="12"
          fontFamily="ui-monospace, monospace"
        >
          {data[i].episode_number === 0
            ? "프롤로그"
            : `${data[i].episode_number}화`}
        </text>
      ))}

      {/* line */}
      <path
        d={linePath}
        fill="none"
        stroke="oklch(0.78 0.13 240)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* dots — hollow ring (시안 line 187-189 정합) */}
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="5.5"
          fill="oklch(0.16 0.005 270)"
          stroke="oklch(0.78 0.13 240)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
