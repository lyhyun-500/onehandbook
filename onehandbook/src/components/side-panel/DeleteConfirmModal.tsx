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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-xl border p-6 shadow-xl"
        style={{
          borderColor: "var(--color-sidepanel-border-subtle)",
          background: "var(--color-sidepanel-card)",
        }}
      >
        <h2
          id="delete-confirm-title"
          className="text-lg font-semibold"
          style={{ color: "var(--color-sidepanel-text-primary)" }}
        >
          {title}
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--color-sidepanel-text-secondary)" }}
        >
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--color-sidepanel-border-subtle)",
              color: "var(--color-sidepanel-text-primary)",
              background: "var(--color-sidepanel-bg)",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{
              borderColor: "color-mix(in srgb, var(--color-sidepanel-danger) 40%, transparent)",
              background: "color-mix(in srgb, var(--color-sidepanel-danger) 18%, var(--color-sidepanel-bg))",
              color: "color-mix(in srgb, var(--color-sidepanel-danger) 70%, #ffffff)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
