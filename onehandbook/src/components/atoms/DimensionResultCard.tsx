"use client";

import { getAnalysisScoreColor } from "@/lib/analysisScoreColor";

interface DimensionResultCardProps {
  label: string;
  score: number;
  comment: string;
}

export function DimensionResultCard({
  label,
  score,
  comment,
}: DimensionResultCardProps) {
  const tone = getAnalysisScoreColor(score);
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/60 p-5 transition-all hover:ring-1 hover:ring-stone-700/60">
      <header className="flex items-baseline justify-between">
        <h3 className="font-serif text-[14px] text-stone-300">{label}</h3>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-stone-600">
          /100
        </span>
      </header>
      <div>
        <span
          className={`font-serif text-[44px] font-medium leading-none tabular-nums ${tone}`}
        >
          {score}
        </span>
      </div>
      <p className="font-serif text-[13px] leading-relaxed text-stone-300">
        {comment}
      </p>
    </article>
  );
}
