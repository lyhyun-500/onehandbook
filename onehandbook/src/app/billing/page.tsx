import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { AppShellHeader } from "@/components/AppShellHeader";

export default async function BillingPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const balance = appUser.nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={balance}
      />

      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
          크레딧
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">NAT 충전</h1>
        <p className="mt-2 text-sm text-zinc-400">
          <CopyWithBreaks as="span" className="block">
            Novel Agent Token (NAT)은 AI 분석 실행 시 소모됩니다.
          </CopyWithBreaks>
        </p>

        <div className="mt-8 rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-6 shadow-lg shadow-black/20">
          <p className="text-xs text-zinc-500">현재 잔액</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-cyan-400">
            {balance.toLocaleString()}
            <span className="ml-2 text-lg font-semibold text-zinc-500">NAT</span>
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-200">충전 안내</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            <CopyWithBreaks as="span" className="block">
              유료 충전·정기 결제 연동은 준비 중입니다. 운영 정책이 정해지면 패키지를 구매하실 수 있습니다.
            </CopyWithBreaks>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            <CopyWithBreaks as="span" className="block">
              NAT가 필요한 테스터분들께서는 문의 메일로 문의 주시면 빠르게 지급해드리도록 하겠습니다.
            </CopyWithBreaks>
          </p>
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900/60"
        >
          ← 대시보드로
        </Link>
      </main>
    </div>
  );
}
