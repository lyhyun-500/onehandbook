"use client";

import { useEffect } from "react";

type DeleteConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmModal({
  open,
  title,
  message,
  confirmLabel = "삭제",
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <h2
          id="delete-confirm-title"
          className="text-lg font-semibold text-zinc-100"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-950/60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
