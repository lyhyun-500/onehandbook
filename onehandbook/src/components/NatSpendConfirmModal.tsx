"use client";

import Link from "next/link";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";

export type NatSpendLine = { label: string; nat: number };

type NatSpendConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  lines: NatSpendLine[];
  totalNat: number;
  balance: number;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function NatSpendConfirmModal({
  open,
  title,
  description,
  lines,
  totalNat,
  balance,
  confirmLabel = "확인 후 분석",
  loading,
  onCancel,
  onConfirm,
}: NatSpendConfirmModalProps) {
  if (!open) return null;

  const canAfford = balance >= totalNat;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nat-modal-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-cyan-500/10 bg-zinc-900 shadow-2xl shadow-black/40"
      >
        {loading && (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
              aria-hidden
            >
              <div className="ohb-scan-beam" />
            </div>
            <p className="pointer-events-none absolute bottom-[5.25rem] left-0 right-0 z-20 px-4 text-center text-[11px] leading-snug text-cyan-400/90 sm:text-xs">
              <CopyWithBreaks as="span">
                에이전트가 원고를 정밀 분석 중입니다...
              </CopyWithBreaks>
            </p>
          </>
        )}
        <div className="relative z-0 p-6">
          <h2
            id="nat-modal-title"
            className="text-lg font-semibold text-zinc-100"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm text-zinc-400">
              <CopyWithBreaks as="span" className="block">
                {description}
              </CopyWithBreaks>
            </p>
          )}

          <ul className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm">
          {lines.map((line, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 text-zinc-300"
            >
              <span className="text-zinc-400">
                <CopyWithBreaks as="span">{line.label}</CopyWithBreaks>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-cyan-300">
                {line.nat} NAT
              </span>
            </li>
          ))}
            <li className="flex items-center justify-between border-t border-zinc-800 pt-2 text-zinc-100">
              <span className="font-medium">합계</span>
              <span className="tabular-nums text-lg font-bold text-cyan-400">
                {totalNat} NAT
              </span>
            </li>
          </ul>

          <p className="mt-3 text-sm text-zinc-500">
            보유 NAT:{" "}
            <span className="font-medium text-zinc-300">{balance}</span>
          </p>

          {!canAfford ? (
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-sm text-amber-200/95">
              <CopyWithBreaks as="p">
                잔액이 부족합니다. 충전 후 다시 시도해 주세요.
              </CopyWithBreaks>
              <p className="mt-1 text-xs text-amber-200/70">
                필요 {totalNat} NAT · 보유 {balance} NAT
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-cyan-200/80">
              <span className="font-semibold text-cyan-300">{totalNat} NAT</span>{" "}
              <CopyWithBreaks as="span">
                가 소모됩니다. 계속할까요?
              </CopyWithBreaks>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
            >
              취소
            </button>
            {!canAfford ? (
              <Link
                href="/billing"
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400"
              >
                NAT 충전하기
              </Link>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "처리 중…" : confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
