"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { SubscriptionCard, type SubscriptionInfo } from "./SubscriptionCard";
import { HistoryTable, type HistoryTableColumn } from "./HistoryTable";

export interface BillingRow {
  id: string;
  product: string;
  amount: number;
  nat: number;
  date: string;
}

export interface NatUsageRow {
  id: string;
  work: string;
  kind: "개별" | "일괄";
  amount: number;
  date: string;
}

export interface AccountClientProps {
  subscription: SubscriptionInfo | null;
  billingRows: BillingRow[];
  natUsageRows: NatUsageRow[];
  natBalance: number;
  nextAutoRecharge: string | null;
  profileSection: ReactNode;
  menuSection: ReactNode;
  heroSection: ReactNode;
}

const BILLING_COLUMNS: HistoryTableColumn<BillingRow>[] = [
  { key: "product", label: "결제 상품", align: "left" },
  { key: "amount", label: "결제 금액", align: "right" },
  { key: "nat", label: "지급 NAT", align: "right" },
  { key: "date", label: "날짜", align: "right" },
];

const NAT_COLUMNS: HistoryTableColumn<NatUsageRow>[] = [
  { key: "work", label: "작품명", align: "left" },
  { key: "kind", label: "분석 종류", align: "left" },
  { key: "amount", label: "소모 NAT", align: "right" },
  { key: "date", label: "날짜", align: "right" },
];

export function AccountClient({
  subscription,
  billingRows,
  natUsageRows,
  natBalance,
  nextAutoRecharge,
  profileSection,
  menuSection,
  heroSection,
}: AccountClientProps) {
  const [activePanel, setActivePanel] = useState<"billing" | "nat" | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-8 py-8">
      {heroSection}
      {profileSection}

      <SubscriptionCard
        subscription={subscription}
        onToggleBilling={() =>
          setActivePanel((p) => (p === "billing" ? null : "billing"))
        }
        billingPanelOpen={activePanel === "billing"}
      />

      {activePanel === "billing" && (
        <HistoryTable
          title="결제 내역"
          kicker="결제·구독"
          columns={BILLING_COLUMNS}
          rows={billingRows}
          onClose={() => setActivePanel(null)}
          emptyMessage="결제 내역이 없습니다."
          renderCell={(row, key) => {
            if (key === "product") return row.product;
            if (key === "amount") return `₩${row.amount.toLocaleString()}`;
            if (key === "nat") return <span className="text-sky-300">+{row.nat}</span>;
            if (key === "date") return row.date;
            return null;
          }}
        />
      )}

      <section className="mb-6 mt-6 rounded-lg border border-stone-800/60 bg-stone-900/30 px-6 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-sky-300/80">NAT 잔액</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-3xl text-sky-200 tabular-nums">{natBalance}</span>
              <span className="text-sm text-stone-400">NAT</span>
            </div>
            {nextAutoRecharge && (
              <p className="mt-2 text-[12px] text-stone-400">{nextAutoRecharge}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "nat" ? null : "nat"))}
              className="rounded-md border border-stone-800 px-3 py-1.5 text-[13px] text-stone-400 transition hover:text-stone-200"
            >
              사용 내역 {activePanel === "nat" ? "↑" : "↓"}
            </button>
            <Link
              href="/pricing"
              className="rounded-md bg-sky-400/10 px-3 py-1.5 text-[13px] text-sky-200 ring-1 ring-sky-400/30 transition hover:bg-sky-400/[0.16]"
            >
              충전
            </Link>
          </div>
        </div>
      </section>

      {activePanel === "nat" && (
        <HistoryTable
          title="NAT 사용 내역"
          kicker="NAT 잔액"
          columns={NAT_COLUMNS}
          rows={natUsageRows}
          onClose={() => setActivePanel(null)}
          emptyMessage="사용 내역이 없습니다."
          renderCell={(row, key) => {
            if (key === "work") return row.work;
            if (key === "kind") {
              const isJoint = row.kind === "일괄";
              return (
                <span
                  className={
                    isJoint
                      ? "rounded-md border border-amber-400/25 bg-amber-400/[0.08] px-2 py-0.5 text-[11px] text-amber-200"
                      : "rounded-md border border-stone-800 bg-stone-900/40 px-2 py-0.5 text-[11px] text-stone-300"
                  }
                >
                  {row.kind}
                </span>
              );
            }
            if (key === "amount") return <span className="text-rose-300">{row.amount} NAT</span>;
            if (key === "date") return row.date;
            return null;
          }}
        />
      )}

      {menuSection}
    </main>
  );
}

export { Coins };
