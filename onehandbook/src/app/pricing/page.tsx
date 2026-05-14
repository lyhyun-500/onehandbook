import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { CurrentBalanceCard } from "./_components/CurrentBalanceCard";
import {
  PackageCard,
  type PricingPackage,
} from "./_components/PackageCard";
import { PolicySection } from "./_components/PolicySection";
import { FAQSection } from "./_components/FAQSection";

export const metadata: Metadata = {
  title: `NAT 충전 · ${SITE_NAME}`,
  description: `${SITE_NAME} NAT 패키지 안내 + 차감 정책 + FAQ`,
};

/**
 * 시안 `design_novel/novel-agent/pricing.jsx:289-359` 정합 — MOCK_PACKAGES.
 *
 * X2 (a) 정합: 시안 본질 우선. CLAUDE.md 기존 패키지 (50/100/200) 영역과 충돌 — 별 sub-phase #88 영역 갱신.
 */
const PRICING_PACKAGES: PricingPackage[] = [
  {
    id: "starter",
    name: "스타터",
    nat: 10,
    price_krw: 5000,
    is_recommended: false,
    blurb: "감 잡고 싶을 때",
  },
  {
    id: "writer",
    name: "작가",
    nat: 30,
    price_krw: 12000,
    is_recommended: true,
    blurb: "한 달 연재 분량",
    save_pct: 20,
  },
  {
    id: "pro",
    name: "프로",
    nat: 100,
    price_krw: 35000,
    is_recommended: false,
    blurb: "전업 작가용",
    save_pct: 30,
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const lowBalance = from === "insufficient";

  // /pricing = (app)/ 외부 유지 (X4 (a) 정합). 비인증 통과 본질.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let balance = 0;
  let lastChargedAt: string | null = null;

  if (user) {
    // public.users 행 + coin_logs 적립 최신 영역 (LEE 결정 Y1 (a) 정합)
    const { data: userRow } = await supabase
      .from("users")
      .select("id, coin_balance")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (userRow) {
      balance = (userRow.coin_balance as number | null) ?? 0;

      const { data: lastCoinLog } = await supabase
        .from("coin_logs")
        .select("created_at")
        .eq("user_id", userRow.id)
        .gt("amount", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      lastChargedAt =
        (lastCoinLog?.created_at as string | null | undefined) ?? null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* 402 INSUFFICIENT_NAT alert strip (?from=insufficient 진입) */}
      {lowBalance && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-200"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[13.5px] text-amber-100">
              분석을 계속하려면 NAT가 필요합니다
            </div>
            <div className="mt-0.5 text-[11.5px] text-amber-200/70">
              <span className="font-mono">402 · INSUFFICIENT_NAT</span> ·
              마지막으로 시도한 회차는 충전 후 자동 재개됩니다.
            </div>
          </div>
        </div>
      )}

      <CurrentBalanceCard
        balance={balance}
        lastChargedAt={lastChargedAt}
        lowBalance={lowBalance}
      />

      <section className="mt-8">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
              PACKAGES
            </div>
            <h2 className="mt-0.5 font-serif text-[17px] text-stone-100">
              NAT 패키지
            </h2>
          </div>
          <div className="hidden text-right text-[10.5px] text-stone-500 md:block">
            모든 결제는 Paddle을 통해 안전하게 처리됩니다.
            <br />
            VAT 포함 · 영수증은 가입 이메일로 발송
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRICING_PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              autoFeatured={lowBalance && pkg.id === "writer"}
            />
          ))}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_1fr]">
        <PolicySection />
        <FAQSection />
      </section>

      <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-800/60 pt-5 font-mono text-[10px] uppercase tracking-widest text-stone-600">
        <span>NOVEL AGENT · BETA</span>
        <span className="text-stone-800" aria-hidden="true">
          /
        </span>
        <Link href="/terms" className="hover:text-stone-400">
          이용약관
        </Link>
        <Link href="/refund" className="hover:text-stone-400">
          환불 정책
        </Link>
        {/* 사업자 정보 = 9월 사업자 등록 후 link 적용 영역 (LEE 결정 Y3, CLAUDE.md 정합) */}
        <span className="text-stone-700" title="사업자 등록 완료 후 안내 예정">
          사업자 정보
        </span>
        <span className="ml-auto">Powered by Paddle</span>
      </footer>
    </div>
  );
}
