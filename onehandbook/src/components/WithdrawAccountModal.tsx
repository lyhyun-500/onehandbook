"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import {
  clearClientPersistencePreferenceCookie,
} from "@/lib/supabase/authPersistence";

const PHRASE = "탈퇴합니다";

type WithdrawAccountModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WithdrawAccountModal({ open, onClose }: WithdrawAccountModalProps) {
  const labelId = useId();
  const inputId = useId();
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = phrase.trim() === PHRASE && !submitting;

  useEffect(() => {
    if (!open) {
      setPhrase("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: phrase.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "탈퇴 처리에 실패했습니다."
        );
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      clearClientPersistencePreferenceCookie();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <h2 id={labelId} className="text-lg font-semibold text-zinc-100">
          회원 탈퇴
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          탈퇴 시 모든 작품, 회차, 분석 결과, 소유{" "}
          <span className="font-semibold text-cyan-300">NAT 코인</span>
          이 삭제되며 복구할 수 없습니다.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm text-zinc-300">
              아래 문구를 그대로 입력해 주세요.
            </label>
            <p className="mb-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 font-mono text-sm text-amber-100/90">
              {PHRASE}
            </p>
            <input
              id={inputId}
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40"
              placeholder={PHRASE}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <CopyWithBreaks as="span">{error}</CopyWithBreaks>
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800/80 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
