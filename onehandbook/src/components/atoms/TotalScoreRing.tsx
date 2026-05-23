"use client";

import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";

interface TotalScoreRingProps {
  score: number | null | undefined;
  size?: number;
}

function strokeTone(score: number | null | undefined): string {
  if (score == null) return "oklch(0.30 0.005 270)";
  if (score >= 88) return "oklch(0.78 0.13 145)";
  if (score >= 80) return "oklch(0.82 0.12 80)";
  if (score >= 72) return "oklch(0.78 0.12 60)";
  return "oklch(0.72 0.10 30)";
}

export function TotalScoreRing({ score, size = 160 }: TotalScoreRingProps) {
  const radius = (size - 14) / 2;
  const circ = 2 * Math.PI * radius;
  const safeScore = typeof score === "number" && Number.isFinite(score) ? score : null;
  const pct = safeScore != null ? (safeScore / 100) * circ : 0;
  const tone = strokeTone(safeScore);
  const textTone = getAnalysisScoreColor(safeScore);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.25 0.005 270)"
          strokeWidth="3"
        />
        {safeScore != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth="3"
            strokeDasharray={`${pct} ${circ}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-serif text-[58px] font-medium leading-none tabular-nums ${textTone}`}
        >
          {safeScore ?? "—"}
        </span>
        <span className="mt-2 font-mono text-[10px] tabular-nums text-stone-500">
          /100
        </span>
      </div>
    </div>
  );
}
