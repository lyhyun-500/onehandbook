// TODO: 향후 ADR 작성 — 정보 노출 정책 / 마케팅 동의 / 탈퇴 위치
// (현재 즉흥 구현, 베타 운영 후 정책 ADR 화)

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { TopBar } from "@/components/shell/TopBar";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function providerLabel(p: string | null): string {
  if (p === "google") return "Google";
  if (p === "naver") return "Naver";
  return "이메일";
}

export default async function AccountPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  // RLS — 본인 행만 조회됨.
  const { data: profile } = await supabase
    .from("users")
    .select("nickname, login_provider, created_at")
    .eq("id", appUser.id)
    .maybeSingle();

  const nickname = (profile?.nickname as string | null) ?? null;
  const loginProvider = (profile?.login_provider as string | null) ?? null;
  const createdAt = (profile?.created_at as string | null) ?? null;
  const balance = appUser.coin_balance ?? 0;

  return (
    <>
      <TopBar title="계정" natBalance={balance} />

      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-sky-400/90">
          내 계정
        </p>
        <h1 className="text-2xl font-bold text-stone-100">마이페이지</h1>
        <p className="mt-2 text-sm text-stone-400">
          계정 정보와 내가 작성한 항목을 확인합니다.
        </p>

        <section className="mt-8 rounded-xl border border-stone-800 bg-stone-900/50 p-6 shadow-sm shadow-black/20">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-500">닉네임</p>
              <p className="mt-1 text-base font-medium text-stone-100">
                {nickname ?? <span className="text-stone-500">-</span>}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-500">이메일</p>
              <p className="mt-1 truncate text-sm text-stone-200">
                {appUser.email || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">가입 경로</p>
              <p className="mt-1 text-sm text-stone-200">
                {providerLabel(loginProvider)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">가입일</p>
              <p className="mt-1 text-sm text-stone-200">
                {formatDate(createdAt)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-stone-500">현재 NAT 잔량</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-sky-400">
                {balance.toLocaleString()}
                <span className="ml-1 text-base font-semibold text-stone-500">
                  NAT
                </span>
              </p>
            </div>
          </div>
        </section>

        <h2 className="mt-10 text-sm font-semibold text-stone-300">메뉴</h2>
        <ul className="mt-3 space-y-2">
          <li>
            <Link
              href="/account/inquiries"
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-900/40 px-5 py-4 transition-colors hover:border-sky-500/30 hover:bg-stone-900/70"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-sky-500/15 p-2 text-sky-300">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium text-stone-100">
                    내 문의
                  </span>
                  <span className="block text-xs text-stone-500">
                    작성한 1:1 문의와 답변 확인
                  </span>
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 text-stone-500"
                aria-hidden
              />
            </Link>
          </li>
          <li>
            <Link
              href="/pricing"
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-900/40 px-5 py-4 transition-colors hover:border-sky-500/30 hover:bg-stone-900/70"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-sky-500/15 p-2 text-sky-300 text-sm font-bold">
                  N
                </span>
                <span>
                  <span className="block text-sm font-medium text-stone-100">
                    NAT 충전
                  </span>
                  <span className="block text-xs text-stone-500">
                    크레딧 안내 + 잔량 확인
                  </span>
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 text-stone-500"
                aria-hidden
              />
            </Link>
          </li>
        </ul>

        <Link
          href="/studio"
          className="mt-10 inline-flex rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-200 hover:border-stone-500 hover:bg-stone-900/60"
        >
          ← 스튜디오로
        </Link>
      </main>
    </>
  );
}
