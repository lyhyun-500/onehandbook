"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";

type CachedAnalysisChoiceModalProps = {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  /** NAT 미차감으로 저장분만 표시 */
  onLoadCached: () => void;
  /** 동일 원고로 AI 재실행 · NAT 차감 */
  onReanalyze: () => void;
};

export function CachedAnalysisChoiceModal({
  open,
  loading,
  onCancel,
  onLoadCached,
  onReanalyze,
}: CachedAnalysisChoiceModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cached-choice-title"
        className="w-full max-w-md rounded-xl border border-zinc-600/40 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="cached-choice-title"
          className="text-lg font-semibold text-zinc-100"
        >
          저장된 분석 결과가 있습니다
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <CopyWithBreaks as="span" className="block">
            동일 원고·동일 분석 조건의 결과가 이미 있습니다. 저장분을 불러오면 NAT가
            차감되지 않습니다. 새로 분석하면 NAT가 차감됩니다.
          </CopyWithBreaks>
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onLoadCached}
            disabled={loading}
            className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/50 hover:bg-emerald-950/60 disabled:opacity-50"
          >
            {loading ? "처리 중…" : "저장 결과 불러오기"}
          </button>
          <button
            type="button"
            onClick={onReanalyze}
            disabled={loading}
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "처리 중…" : "NAT 차감 · 다시 분석"}
          </button>
        </div>
      </div>
    </div>
  );
}
