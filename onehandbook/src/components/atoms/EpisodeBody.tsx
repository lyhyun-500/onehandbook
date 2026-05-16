"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface EpisodeBodyProps {
  body: string;
  charCount: number;
}

export function EpisodeBody({ body, charCount }: EpisodeBodyProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mt-10">
      <header className="mb-3 flex items-baseline justify-between border-b border-stone-800/60 pb-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-500">
            본문 PREVIEW
          </span>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
          {charCount.toLocaleString()}자
        </span>
      </header>

      <div className="relative rounded-lg border border-stone-800/60 bg-stone-900/40 p-7">
        <div
          className="overflow-hidden whitespace-pre-wrap font-serif text-[14px] leading-[1.85] text-stone-300"
          style={{ textWrap: "pretty", maxHeight: expanded ? "none" : 420 }}
        >
          {body}
        </div>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-lg bg-gradient-to-t from-stone-900/95 via-stone-900/70 to-transparent" />
        )}
      </div>

      <div className="mt-3 flex items-center justify-start gap-3 text-[11px] text-stone-500">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-stone-300 hover:text-sky-200"
        >
          {expanded ? "접기" : "전체 보기"}
          <ChevronRight
            size={10}
            className={expanded ? "-rotate-90" : "rotate-90"}
            aria-hidden="true"
          />
        </button>
        <span>미리보기 일부 발췌</span>
      </div>
    </section>
  );
}
