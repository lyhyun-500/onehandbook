"use client";

import { AlertTriangle, Sparkles } from "lucide-react";

interface AnalysisFailedProps {
  message?: string | null;
  retryNat: number;
  onRetry: () => void;
  onReport?: () => void;
  errorCode?: string | null;
}

export function AnalysisFailed({
  message,
  retryNat,
  onRetry,
  onReport,
  errorCode,
}: AnalysisFailedProps) {
  return (
    <section className="mt-6 rounded-lg border border-rose-400/30 bg-rose-400/[0.04] px-7 py-7">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-400/10 text-rose-300">
          <AlertTriangle size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[15px] text-stone-100">
            분석에 실패했습니다
          </div>
          <p className="mt-1 font-serif text-[12.5px] leading-relaxed text-stone-400">
            {message ||
              "처리 중 오류가 발생했습니다. NAT는 차감되지 않았습니다. 잠시 후 다시 시도해주세요."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[12px] font-medium text-stone-950 hover:bg-sky-400"
            >
              <Sparkles size={11} aria-hidden="true" />
              재분석 ({retryNat} NAT)
            </button>
            {onReport && (
              <button
                type="button"
                onClick={onReport}
                className="rounded-md border border-stone-800 bg-stone-900/40 px-3 py-1.5 text-[12px] text-stone-300 hover:border-stone-700"
              >
                문의함에 신고
              </button>
            )}
          </div>
          {errorCode && (
            <div className="mt-3 font-mono text-[10px] text-stone-600">
              {errorCode}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
