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
import { TopBar } from "@/components/shell/TopBar";

export const metadata: Metadata = {
  title: "NAT 충전",
  description: `${SITE_NAME} NAT 패키지 안내 + 차감 정책 + FAQ`,
};

/**
 * 시안 `design_novel/novel-agent/pricing.jsx:289-359` 정합 — MOCK_PACKAGES.
 *
 * X2 (a) 정합: 시안 본질 우선. CLAUDE.md 기존 패키지 (50/100/200) 영역과 충돌 — 별 sub-phase #88 영역 갱신.
 */
const PADDLE_ENV = (
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? "sandbox"
)
  .trim()
  .toLowerCase();

const PADDLE_PRICE_IDS: Record<string, Record<string, string>> = {
  sandbox: {
    nat_5k: "pri_01ksmh44g0636shcw5p4va893r",
    nat_10k: "pri_01ksmhc8zs3r9cyxjt99q17fqn",
    nat_20k: "pri_01ksmheefcc88njq29mt1mcfht",
    nat_30k: "pri_01ksmhfm5ch2svrh2y1tzytbeb",
    nat_40k: "pri_01ksmhgs0tbpgk9rj0ka073chf",
    nat_50k: "pri_01ksmhhqyea2ebm4v7jwendk14",
  },
  production: {
    nat_5k: "pri_01kspd7ancysqn8rrkxwq69ysm",
    nat_10k: "pri_01kspd8jd6z04g5darm0681txy",
    nat_20k: "pri_01kspd9r2z3azknv8cmgzvp8pb",
    nat_30k: "pri_01kspdaw2sv40hw5ys4k63004p",
    nat_40k: "pri_01kspdcd8kg5dw224pqvfkk9vh",
    nat_50k: "pri_01kspddg9w65zm9qdt5gwptqgw",
  },
};

const priceIds = PADDLE_PRICE_IDS[PADDLE_ENV] ?? PADDLE_PRICE_IDS.sandbox;

const PRICING_PACKAGES: PricingPackage[] = [
  {
    id: "nat_5k",
    name: "NAT 25팩",
    nat: 25,
    base_nat: 25,
    bonus_nat: 0,
    bonus_pct: 0,
    price_krw: 5000,
    is_recommended: false,
    is_max: false,
    paddle_price_id: priceIds.nat_5k,
    blurb: "가볍게 시작",
    analysis_chars_max: 15,
  },
  {
    id: "nat_10k",
    name: "NAT 54팩",
    nat: 54,
    base_nat: 50,
    bonus_nat: 4,
    bonus_pct: 5,
    price_krw: 10000,
    is_recommended: false,
    is_max: false,
    paddle_price_id: priceIds.nat_10k,
    blurb: "보너스 +4 NAT",
    analysis_chars_max: 32,
  },
  {
    id: "nat_20k",
    name: "NAT 110팩",
    nat: 110,
    base_nat: 100,
    bonus_nat: 10,
    bonus_pct: 10,
    price_krw: 20000,
    is_recommended: false,
    is_max: false,
    paddle_price_id: priceIds.nat_20k,
    blurb: "보너스 +10 NAT",
    analysis_chars_max: 66,
  },
  {
    id: "nat_30k",
    name: "NAT 174팩",
    nat: 174,
    base_nat: 150,
    bonus_nat: 24,
    bonus_pct: 15,
    price_krw: 30000,
    is_recommended: true,
    is_max: false,
    paddle_price_id: priceIds.nat_30k,
    blurb: "보너스 +24 NAT",
    analysis_chars_max: 104,
  },
  {
    id: "nat_40k",
    name: "NAT 240팩",
    nat: 240,
    base_nat: 200,
    bonus_nat: 40,
    bonus_pct: 20,
    price_krw: 40000,
    is_recommended: false,
    is_max: false,
    paddle_price_id: priceIds.nat_40k,
    blurb: "보너스 +40 NAT",
    analysis_chars_max: 144,
  },
  {
    id: "nat_50k",
    name: "NAT 314팩",
    nat: 314,
    base_nat: 250,
    bonus_nat: 64,
    bonus_pct: 25,
    price_krw: 50000,
    is_recommended: false,
    is_max: true,
    paddle_price_id: priceIds.nat_50k,
    blurb: "보너스 +64 NAT",
    analysis_chars_max: 188,
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
  let userEmail: string | null = null;
  let userId: number | null = null;

  if (user) {
    // public.users 행 + coin_logs 적립 최신 영역 (LEE 결정 Y1 (a) 정합)
    const { data: userRow } = await supabase
      .from("users")
      .select("id, coin_balance")
      .eq("auth_id", user.id)
      .maybeSingle();

    userEmail = user.email ?? null;
    userId = userRow?.id ?? null;

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
    <div className="flex min-h-screen flex-col bg-stone-950 text-stone-200">
      <TopBar
        title="NAT 충전"
        natBalance={balance}
        actions={
          <Link href="/" className="text-sm text-stone-400 transition hover:text-stone-200">
            홈으로
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
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
              autoFeatured={pkg.is_recommended}
              userEmail={userEmail}
              userId={userId}
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
      </footer>
      </div>
    </div>
  );
}
