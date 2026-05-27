"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CancelModal } from "./CancelModal";

export interface SubscriptionInfo {
  id: string;
  planLabel: string;
  cycle: "MONTHLY" | "YEARLY";
  priceKRW: number;
  natAmount: number;
  nextBilledAt: string | null;
  status: "active" | "canceling" | "expired";
}

export interface SubscriptionCardProps {
  subscription: SubscriptionInfo | null;
  onToggleBilling: () => void;
  billingPanelOpen: boolean;
}

const FEATURES_BY_NAT = (nat: number): string[] => [
  `매월 ${nat} NAT 자동 충전`,
  "6개 축 + 유사 흥행작 비교",
  "분석 이력 무제한 보관",
];

export function SubscriptionCard({
  subscription,
  onToggleBilling,
  billingPanelOpen,
}: SubscriptionCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  async function handleUpdatePayment() {
    if (!subscription) return;
    setUpdatingPayment(true);
    try {
      const res = await fetch(
        `/api/account/subscription/update-payment-method?subscription_id=${subscription.id}`,
      );
      const j = await res.json();
      if (!res.ok || !j?.transaction_id) {
        throw new Error(j?.error ?? "결제 수단 변경 준비 실패");
      }
      // Paddle.js Checkout overlay open
      const Paddle = (globalThis as { Paddle?: { Checkout: { open: (opts: { transactionId: string }) => void } } }).Paddle;
      if (!Paddle?.Checkout) {
        throw new Error("Paddle.js 미로드");
      }
      Paddle.Checkout.open({ transactionId: j.transaction_id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "결제 수단 변경 실패");
    } finally {
      setUpdatingPayment(false);
    }
  }

  // Empty state — 활성 구독 없음
  if (!subscription) {
    return (
      <section className="mb-6 rounded-lg border border-stone-800/60 bg-stone-900/30">
        <header className="border-b border-stone-800/60 px-6 py-4">
          <p className="text-[11px] uppercase tracking-widest text-sky-300/80">결제·구독</p>
          <h2 className="mt-1 font-serif text-xl text-stone-100">현재 구독</h2>
        </header>
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-stone-400">현재 구독 중인 플랜이 없습니다.</p>
          <Link
            href="/pricing"
            className="mt-4 inline-block rounded-md bg-sky-400/[0.08] px-4 py-2 text-sm text-sky-200 ring-1 ring-sky-400/30 transition hover:bg-sky-400/[0.12]"
          >
            구독하기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mb-6 rounded-lg border border-stone-800/60 bg-stone-900/30">
        <header className="flex items-center justify-between border-b border-stone-800/60 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-sky-300/80">결제·구독</p>
            <h2 className="mt-1 font-serif text-xl text-stone-100">현재 구독</h2>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            활성
          </span>
        </header>

        <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr]">
          {/* 좌: 플랜 요약 */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl text-stone-100">{subscription.planLabel}</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-stone-500">
                {subscription.cycle}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-xl tabular-nums text-stone-100">
                ₩{subscription.priceKRW.toLocaleString()}
              </span>
              <span className="text-sm text-stone-500">/ 월</span>
            </div>
            <ul className="mt-4 space-y-2">
              {FEATURES_BY_NAT(subscription.natAmount).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-stone-300">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* 우: 다음 결제 박스 */}
          <div className="rounded-md border border-stone-800/80 bg-stone-950/40 p-4">
            <p className="text-[11px] uppercase tracking-widest text-stone-500">다음 결제 예정</p>
            <p className="mt-1 font-serif text-lg text-stone-100">
              {subscription.nextBilledAt
                ? new Date(subscription.nextBilledAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </p>
            <p className="mt-1 text-[12px] text-stone-400">
              자동 갱신 · ₩{subscription.priceKRW.toLocaleString()}
            </p>
            <div className="my-4 border-t border-stone-800/60" />
            <p className="text-[11px] uppercase tracking-widest text-stone-500">결제 수단</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-stone-300">등록된 카드</span>
              <button
                type="button"
                onClick={handleUpdatePayment}
                disabled={updatingPayment}
                className="text-[12px] text-stone-400 transition hover:text-stone-200 disabled:opacity-50"
              >
                {updatingPayment ? "준비 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-stone-800/60 bg-stone-950/30 px-6 py-3">
          <div className="flex items-center gap-3 text-[13px]">
            <button
              type="button"
              onClick={onToggleBilling}
              className="text-stone-400 transition hover:text-stone-200"
            >
              결제 내역 {billingPanelOpen ? "↑" : "↓"}
            </button>
            <span className="text-stone-700">·</span>
            <Link
              href="/pricing"
              className="text-stone-400 transition hover:text-stone-200"
            >
              플랜 변경
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="rounded-md border border-stone-800 px-3 py-1.5 text-[13px] text-stone-400 transition hover:border-rose-500/30 hover:text-rose-300/90"
          >
            구독 해지
          </button>
        </footer>
      </section>

      {cancelOpen && (
        <CancelModal
          subscriptionId={subscription.id}
          nextBilledAt={subscription.nextBilledAt}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </>
  );
}
