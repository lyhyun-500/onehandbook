"use client";

import { Sparkles } from "lucide-react";

interface AnalysisCTAProps {
  totalNat: number;
  costHint: string;
  onAnalyze: () => void;
  disabled?: boolean;
}

export function AnalysisCTA({
  totalNat,
  costHint,
  onAnalyze,
  disabled,
}: AnalysisCTAProps) {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-stone-700 bg-stone-900/40 px-8 py-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/[0.08] text-sky-300 ring-1 ring-inset ring-sky-400/20">
          <Sparkles size={22} aria-hidden="true" />
        </div>
        <h3 className="font-serif text-[18px] text-stone-100">AI 분석 진입</h3>
        <p className="mt-2 font-serif text-[13px] leading-relaxed text-stone-400">
          이 회차를 AI로 분석합니다. 6축 점수와 회차별 코멘트가 자동으로 정리됩니다.
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
            차감
          </span>
          <span className="font-mono text-[12px] font-medium tabular-nums text-sky-300">
            {totalNat} NAT
          </span>
          <span className="text-[11px] text-stone-500">{costHint}</span>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled}
          className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-md bg-sky-500 px-5 text-[13px] font-medium text-stone-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={12} aria-hidden="true" />
          분석 진입
        </button>
        <div className="mt-2 font-mono text-[10px] text-stone-600">
          6,000자 이하 = 1 NAT · ~10,000자 = 2 NAT · 초과 = 3 NAT
        </div>
      </div>
    </section>
  );
}
