"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import {
  clearClientPersistencePreferenceCookie,
} from "@/lib/supabase/authPersistence";

const REASONS = [
  { value: "비용이 부담돼요", label: "💰 비용이 부담돼요" },
  { value: "원하는 기능이 없어요", label: "🔍 원하는 기능이 없어요" },
  { value: "분석 품질이 기대에 못 미쳐요", label: "🤖 분석 품질이 기대에 못 미쳐요" },
  { value: "더 좋은 서비스를 찾았어요", label: "⚡ 더 좋은 서비스를 찾았어요" },
  { value: "당분간 쓸 일이 없어요", label: "🕐 당분간 쓸 일이 없어요" },
  { value: "기타", label: "📝 기타 (직접 입력)" },
] as const;
type WithdrawReason = (typeof REASONS)[number]["value"];

type WithdrawAccountModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WithdrawAccountModal({ open, onClose }: WithdrawAccountModalProps) {
  const labelId = useId();
  const detailId = useId();
  const agreeId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<WithdrawReason | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = reason !== "" && (reason !== "기타" || reasonDetail.trim().length >= 2);
  const canSubmit = agreed && !submitting;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setReason("");
      setReasonDetail("");
      setAgreed(false);
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
        body: JSON.stringify({
          reason,
          reasonDetail: reason === "기타" ? reasonDetail.trim() : "",
          confirmed: agreed,
        }),
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
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-200">탈퇴 이유를 선택해 주세요.</p>
              <div className="space-y-2">
                {REASONS.map((r) => {
                  const checked = reason === r.value;
                  return (
                    <label
                      key={r.value}
                      className={[
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        checked
                          ? "border-red-500/50 bg-red-500/10 text-zinc-100"
                          : "border-zinc-700 bg-zinc-950/10 text-zinc-200 hover:bg-zinc-800/50",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="withdraw_reason"
                        value={r.value}
                        checked={checked}
                        onChange={() => setReason(r.value)}
                        className="h-4 w-4 accent-red-500"
                      />
                      <span>{r.label}</span>
                    </label>
                  );
                })}
              </div>
              {reason === "기타" && (
                <div className="pt-1">
                  <label htmlFor={detailId} className="mb-1.5 block text-sm text-zinc-300">
                    기타 사유를 입력해 주세요.
                  </label>
                  <textarea
                    id={detailId}
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    placeholder="예) 기능이 부족해서요"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-200">마지막으로 확인해 주세요.</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                <li>탈퇴 시 작품/회차/분석 결과/NAT 코인이 삭제되며 복구할 수 없습니다.</li>
                <li>탈퇴 후 동일 계정으로 재가입하더라도 이전 데이터는 복구되지 않습니다.</li>
              </ul>
              <label
                htmlFor={agreeId}
                className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-950/10 px-3 py-3 text-sm text-zinc-200 hover:bg-zinc-800/50"
              >
                <input
                  id={agreeId}
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-red-500"
                />
                <span>위 사항을 확인했으며 탈퇴에 동의합니다</span>
              </label>
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <CopyWithBreaks as="span">{error}</CopyWithBreaks>
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setAgreed(false);
                  setError(null);
                  setSubmitting(false);
                } else {
                  onClose();
                }
              }}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800/80 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              {step === 2 ? "이전" : "취소"}
            </button>
            <button
              type={step === 2 ? "submit" : "button"}
              disabled={step === 1 ? !canNext : !canSubmit}
              onClick={() => {
                if (step === 1) {
                  if (!canNext) return;
                  setStep(2);
                  setError(null);
                }
              }}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 1 ? "다음" : submitting ? "처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
