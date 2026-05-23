"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { TotalScoreRing } from "./TotalScoreRing";

interface OverallSummaryCardProps {
  score: number | null | undefined;
  title: string;
  body: ReactNode;
  onJumpToDims?: () => void;
  onBackToEpisode?: () => void;
  onRerun?: () => void;
  rerunDisabled?: boolean;
}

export function OverallSummaryCard({
  score,
  title,
  body,
  onJumpToDims,
  onBackToEpisode,
  onRerun,
  rerunDisabled,
}: OverallSummaryCardProps) {
  return (
    <section className="relative mt-6 grid grid-cols-1 items-center gap-8 rounded-xl border border-stone-800/60 bg-gradient-to-br from-stone-900/50 to-stone-900/20 p-8 md:grid-cols-[180px_1fr]">
      {onRerun && (
        <button
          type="button"
          onClick={onRerun}
          disabled={rerunDisabled}
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/60 px-2.5 py-1.5 text-[11.5px] text-stone-300 transition-colors hover:border-sky-400/40 hover:bg-stone-800 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={12} aria-hidden="true" />
          재분석
        </button>
      )}
      <div className="flex justify-center md:justify-start">
        <TotalScoreRing score={score} size={160} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/85">
          총평
        </div>
        <h2 className="mt-2 font-serif text-[22px] leading-snug text-stone-100">
          {title}
        </h2>
        <div className="mt-3 max-w-2xl font-serif text-[13.5px] leading-relaxed text-stone-300">
          {body}
        </div>
        {(onJumpToDims || onBackToEpisode) && (
          <div className="mt-5 flex items-center gap-2">
            {onJumpToDims && (
              <button
                type="button"
                onClick={onJumpToDims}
                className="flex h-9 items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-400/[0.08] px-3 text-[12.5px] text-sky-200 hover:bg-sky-400/[0.14]"
              >
                개선 포인트 보기
              </button>
            )}
            {onBackToEpisode && (
              <button
                type="button"
                onClick={onBackToEpisode}
                className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
              >
                회차로 돌아가기
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
