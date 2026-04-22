"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { NatAdjustFailure, NatAdjustSuccess } from "@/lib/admin/types";

type Props = {
  userId: number;
  currentBalance: number;
};

type AdjustType = "charge" | "deduct";

const REASON_MAX = 500;

function mapError(
  code: string | undefined,
  balance?: number,
  required?: number
): string {
  switch (code) {
    case "invalid_amount":
      return "수량이 유효하지 않습니다. (1 ~ 100,000 정수)";
    case "reason_required":
    case "admin_reason_required":
      return "사유를 입력해주세요.";
    case "reason_too_long":
    case "admin_reason_too_long":
      return "사유는 500자 이하여야 합니다.";
    case "user_not_found":
      return "대상 유저를 찾을 수 없습니다.";
    case "insufficient_balance":
      return `잔량 부족 (현재 ${balance ?? 0}, 필요 ${required ?? 0}).`;
    case "invalid_reason":
      return "유효하지 않은 사유 코드입니다.";
    case "admin_auth_id_required":
      return "관리자 식별자 누락.";
    case "invalid_user_id":
      return "유저 ID 가 유효하지 않습니다.";
    case "invalid_type":
      return "조정 유형이 유효하지 않습니다.";
    case "update_failed":
      return "업데이트 실패. 다시 시도해주세요.";
    case "service_role_unavailable":
      return "서버 설정 오류 (service role). 운영자에게 문의.";
    case "Unauthorized":
      return "권한이 없습니다. 다시 로그인해주세요.";
    default:
      return code ?? "알 수 없는 오류가 발생했습니다.";
  }
}

export function NatAdjustForm({ userId, currentBalance }: Props) {
  const router = useRouter();

  const [type, setType] = useState<AdjustType>("charge");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const amountNum = useMemo(() => {
    const n = parseInt(amountStr, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [amountStr]);

  const isAmountValid =
    Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= 100000;
  const reasonTrimmed = reason.trim();
  const isReasonValid =
    reasonTrimmed.length >= 1 && reasonTrimmed.length <= REASON_MAX;
  const canRequest = isAmountValid && isReasonValid && !submitting;

  const previewBalance = isAmountValid
    ? type === "charge"
      ? currentBalance + amountNum
      : currentBalance - amountNum
    : null;
  const willGoNegative =
    type === "deduct" && previewBalance !== null && previewBalance < 0;

  const onRequestAdjust = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!canRequest) return;
    if (willGoNegative) {
      setErrorMsg("차감 후 잔량이 음수가 됩니다. 수량을 확인해주세요.");
      return;
    }
    setConfirming(true);
  };

  const onCancel = () => {
    if (submitting) return;
    setConfirming(false);
  };

  const onConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/nat-adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId,
          type,
          amount: amountNum,
          reason: reasonTrimmed,
        }),
      });
      const body = (await res.json()) as
        | NatAdjustSuccess
        | NatAdjustFailure;
      if (!res.ok || !body.ok) {
        const fail = body as NatAdjustFailure;
        setErrorMsg(mapError(fail.error, fail.balance, fail.required));
        setConfirming(false);
        return;
      }
      setSuccessMsg(
        `${type === "charge" ? "충전" : "차감"} 완료. 새 잔량: ${body.newBalance.toLocaleString()}`
      );
      setConfirming(false);
      setAmountStr("");
      setReason("");
      router.refresh();
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다."
      );
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded border border-admin-border-strong bg-admin-bg-surface p-5">
      <div className="grid grid-cols-[140px_1fr] gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
            조정 유형
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("charge")}
              disabled={submitting}
              className={[
                "h-9 flex-1 rounded border px-3 text-sm font-medium transition-colors",
                type === "charge"
                  ? "border-admin-accent bg-admin-accent text-white"
                  : "border-admin-border-strong bg-admin-bg-page text-admin-text-secondary hover:bg-admin-bg-hover",
              ].join(" ")}
            >
              충전
            </button>
            <button
              type="button"
              onClick={() => setType("deduct")}
              disabled={submitting}
              className={[
                "h-9 flex-1 rounded border px-3 text-sm font-medium transition-colors",
                type === "deduct"
                  ? "border-transparent text-white"
                  : "border-admin-border-strong bg-admin-bg-page text-admin-text-secondary hover:bg-admin-bg-hover",
              ].join(" ")}
              style={
                type === "deduct"
                  ? { backgroundColor: "var(--color-admin-danger)" }
                  : undefined
              }
            >
              차감
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
            수량 (1 ~ 100,000)
          </label>
          <input
            type="number"
            min={1}
            max={100000}
            step={1}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={submitting}
            className="h-9 w-40 rounded border border-admin-border-strong bg-admin-bg-page px-3 text-sm text-admin-text-primary focus:border-admin-accent focus:outline-none"
            placeholder="예: 50"
          />
          {previewBalance !== null && (
            <span className="ml-3 text-xs text-admin-text-secondary">
              조정 후 잔량:{" "}
              <span
                className="font-medium tabular-nums"
                style={{
                  color: willGoNegative
                    ? "var(--color-admin-danger)"
                    : "var(--color-admin-text-primary)",
                }}
              >
                {previewBalance.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-admin-text-secondary">
          사유 (필수, 최대 {REASON_MAX}자)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
          rows={2}
          maxLength={REASON_MAX}
          placeholder="예: 이벤트 보상, 환불 요청, 시스템 오류 복구"
          className="w-full rounded border border-admin-border-strong bg-admin-bg-page px-3 py-2 text-sm text-admin-text-primary placeholder:text-admin-text-muted focus:border-admin-accent focus:outline-none"
        />
        <div className="mt-1 text-right text-xs text-admin-text-muted">
          {reasonTrimmed.length} / {REASON_MAX}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-admin-text-secondary">
          {type === "charge"
            ? "충전: coin_logs 에 EARN / ADMIN_CREDIT 로 기록됩니다."
            : "차감: coin_logs 에 USE / ADMIN_DEBIT 로 기록됩니다."}
        </div>
        <button
          type="button"
          onClick={onRequestAdjust}
          disabled={!canRequest || willGoNegative}
          className={[
            "h-9 rounded px-4 text-sm font-medium text-white transition-colors",
            type === "charge"
              ? "bg-admin-accent hover:bg-admin-accent-hover"
              : "",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
          style={
            type === "deduct"
              ? { backgroundColor: "var(--color-admin-danger)" }
              : undefined
          }
        >
          {type === "charge" ? "충전 실행" : "차감 실행"}
        </button>
      </div>

      {errorMsg && (
        <div
          className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm"
          style={{ color: "var(--color-admin-danger)" }}
        >
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm"
          style={{ color: "var(--color-admin-success)" }}
        >
          {successMsg}
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-lg bg-admin-bg-page p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-admin-text-primary">
              확인
            </h3>
            <p className="mt-3 text-sm text-admin-text-primary">
              정말 이 유저에게{" "}
              <span className="font-semibold">
                {amountNum.toLocaleString()} NAT
              </span>{" "}
              를 <span className="font-semibold">{type === "charge" ? "충전" : "차감"}</span>
              하시겠습니까?
            </p>
            <div className="mt-3 rounded border border-admin-border bg-admin-bg-surface p-3 text-xs text-admin-text-secondary">
              <div>
                사유: <span className="text-admin-text-primary">{reasonTrimmed}</span>
              </div>
              <div className="mt-1">
                조정 후 잔량:{" "}
                <span className="font-medium text-admin-text-primary">
                  {previewBalance?.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="h-9 rounded border border-admin-border-strong bg-admin-bg-page px-4 text-sm text-admin-text-secondary hover:bg-admin-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="h-9 rounded px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor:
                    type === "charge"
                      ? "var(--color-admin-accent)"
                      : "var(--color-admin-danger)",
                }}
              >
                {submitting
                  ? "처리 중…"
                  : type === "charge"
                    ? "충전 실행"
                    : "차감 실행"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
