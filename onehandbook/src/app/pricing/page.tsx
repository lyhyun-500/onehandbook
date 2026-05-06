import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { StandardPlanButton } from "./StandardPlanButton";

export const metadata: Metadata = {
  title: `요금 안내 · ${SITE_NAME}`,
  description: `${SITE_NAME} NAT 요금 및 플랜 안내`,
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-cyan-500/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-zinc-100 hover:text-cyan-200"
          >
            ← {SITE_NAME}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 pb-20">
        <h1 className="text-2xl font-bold text-zinc-50">요금 안내</h1>
        <p className="mt-2 text-sm text-zinc-500">
          NAT(Novel Agent Token)는 AI 분석 이용 시 소모되는 크레딧입니다.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm shadow-black/20">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-500/90">
              플랜
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-100">베타 (무료)</h2>
            <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-50">₩0</p>
            <p className="mt-1 text-sm text-zinc-500">체험·베타 기준</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-cyan-500">·</span>
                주 3 NAT 무료 제공
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-6 shadow-sm shadow-cyan-950/30">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              플랜
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-100">스탠다드</h2>
            <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-50">
              9,900원
              <span className="text-base font-normal text-zinc-500">/월</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">100 NAT</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-cyan-500">·</span>
                월 정기 구독 형태(안내용)
              </li>
            </ul>
            <StandardPlanButton userEmail={userEmail} />
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm shadow-black/20">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              플랜
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-100">NAT 추가 구매</h2>
            <p className="mt-3 text-sm text-zinc-400">필요 시 한 번에 충전</p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <span>50 NAT</span>
                <span className="tabular-nums font-medium text-zinc-100">4,900원</span>
              </li>
              <li className="flex justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <span>100 NAT</span>
                <span className="tabular-nums font-medium text-zinc-100">8,900원</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>200 NAT</span>
                <span className="tabular-nums font-medium text-zinc-100">15,900원</span>
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-10 rounded-lg border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-center text-sm text-amber-100/95">
          현재 베타 운영 중으로 무료로 이용 가능합니다
        </p>

        <p className="mt-8 text-center text-xs text-zinc-600">
          결제·구독 연동은 추후 제공될 수 있으며, 위 금액은 안내용입니다. 환불은{" "}
          <Link
            href="/refund"
            className="text-zinc-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            환불 정책
          </Link>
          을 참고해 주세요.
        </p>
      </main>
    </div>
  );
}
