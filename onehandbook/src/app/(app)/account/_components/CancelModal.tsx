"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export interface CancelModalProps {
  subscriptionId: string;
  nextBilledAt: string | null;
  onClose: () => void;
}

export function CancelModal({ subscriptionId, nextBilledAt, onClose }: CancelModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_id: subscriptionId, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "해지 실패");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "해지 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-800 bg-stone-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-stone-800/60 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose-300/80">구독 해지</p>
            <h3 className="mt-1 font-serif text-xl text-stone-100">정말 해지하시겠어요?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100/[0.04] hover:text-stone-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-stone-300">
            {nextBilledAt
              ? `${nextBilledAt} 까지는 구독 혜택을 계속 이용하실 수 있습니다. 그 이후 자동 갱신이 중단됩니다.`
              : "다음 결제일에 자동 갱신이 중단됩니다."}
          </p>
          <div>
            <label className="text-[12px] text-stone-400">
              해지 사유 <span className="text-stone-600">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="개선에 활용하겠습니다."
              rows={3}
              className="mt-1 w-full rounded-md border border-stone-800 bg-stone-950/60 px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:border-sky-400/40 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[12px] text-rose-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-stone-800/60 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-3 py-1.5 text-sm text-stone-400 transition hover:bg-stone-100/[0.04] hover:text-stone-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-500/[0.12] disabled:opacity-50"
          >
            {submitting ? "처리 중..." : "구독 해지"}
          </button>
        </footer>
      </div>
    </div>
  );
}
