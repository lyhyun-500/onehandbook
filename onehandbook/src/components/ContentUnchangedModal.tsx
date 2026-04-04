"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";

type ContentUnchangedModalProps = {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ContentUnchangedModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: ContentUnchangedModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unchanged-title"
        className="w-full max-w-md rounded-xl border border-zinc-600/40 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="unchanged-title"
          className="text-lg font-semibold text-zinc-100"
        >
          원고 변경 없음
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <CopyWithBreaks as="span" className="block">
            변경된 사항이 없습니다. 그래도 분석하시겠습니까? 동일 원고로 다시 분석하면 NAT가 다시 차감됩니다.
          </CopyWithBreaks>
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
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
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "처리 중…" : "그래도 분석하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
