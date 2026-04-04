"use client";

import { CopyWithBreaks } from "@/components/CopyWithBreaks";

type ManuscriptLowVolumeModalProps = {
  open: boolean;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ManuscriptLowVolumeModal({
  open,
  message,
  confirmLabel = "계속하기",
  loading,
  onCancel,
  onConfirm,
}: ManuscriptLowVolumeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="low-volume-title"
        className="w-full max-w-md rounded-xl border border-amber-500/20 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="low-volume-title"
          className="text-lg font-semibold text-zinc-100"
        >
          원고량 안내
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
          <CopyWithBreaks as="span">{message}</CopyWithBreaks>
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
            {loading ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
