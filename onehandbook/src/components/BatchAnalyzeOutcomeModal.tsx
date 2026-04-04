"use client";

import Link from "next/link";

export type BatchAnalyzeOutcomeModalProps = {
  open: boolean;
  onClose: () => void;
  /** 이번 실행에서 실제로 저장까지 완료된 회차 수 */
  analyzedCount: number;
  /** 이번 실행에서 시도한 전체 회차 수 */
  totalAttempted: number;
  /** NAT 부족으로 중단된 경우 */
  insufficientNat?: { balance: number; required: number };
  /** 그 외 오류로 중단된 경우 (일부 성공 후) */
  otherError?: string;
  /** 마지막으로 성공한 회차 표시용 (예: "3화 · 제목") */
  lastSuccessLabel?: string;
  /** 원고 변경 없음(409)으로 건너뛴 회차 수 */
  skippedUnchanged?: number;
};

export function BatchAnalyzeOutcomeModal({
  open,
  onClose,
  analyzedCount,
  totalAttempted,
  insufficientNat,
  otherError,
  lastSuccessLabel,
  skippedUnchanged,
}: BatchAnalyzeOutcomeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-outcome-title"
        className="w-full max-w-md rounded-xl border border-cyan-500/10 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="batch-outcome-title"
          className="text-lg font-semibold text-zinc-100"
        >
          일괄 분석 결과
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          일부만 반영된 경우, 저장된 회차까지는 그대로 유지됩니다.
        </p>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
          <p>
            <span className="font-semibold text-cyan-300">
              {analyzedCount}개 회차
            </span>
            까지 분석이 저장되었습니다.
            <span className="text-zinc-500">
              {" "}
              (이번에 시도한 전체 {totalAttempted}개 중)
            </span>
          </p>
          {lastSuccessLabel && (
            <p className="text-zinc-500">
              마지막으로 반영된 회차:{" "}
              <span className="text-zinc-200">{lastSuccessLabel}</span>
            </p>
          )}

          {skippedUnchanged != null && skippedUnchanged > 0 && (
            <p className="rounded-lg border border-zinc-600/50 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
              이전 분석과 동일한 원고로 판단되어{" "}
              <span className="font-medium text-zinc-200">
                {skippedUnchanged}개 회차
              </span>
              는 건너뛰었습니다. (NAT 미차감)
            </p>
          )}

          {insufficientNat && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-amber-100/95">
              <p className="font-medium text-amber-100">NAT가 부족합니다</p>
              <p className="mt-1 text-xs text-amber-200/85">
                다음 회차부터는 진행하지 못했습니다. 충전 후 나머지 회차를 다시
                실행해 주세요.
              </p>
              <p className="mt-2 text-xs tabular-nums text-amber-200/70">
                실패 구간 기준 · 필요 {insufficientNat.required} NAT · 잔여{" "}
                {insufficientNat.balance} NAT
              </p>
            </div>
          )}

          {otherError && (
            <div className="rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-red-200/95">
              <p className="text-xs font-medium text-red-100">이후 요청 오류</p>
              <p className="mt-1 text-sm">{otherError}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            확인
          </button>
          {insufficientNat && (
            <Link
              href="/billing"
              className="rounded-lg bg-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400"
              onClick={onClose}
            >
              NAT 충전하기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
