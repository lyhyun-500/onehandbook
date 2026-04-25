"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { HeaderAnalysisBell } from "@/contexts/AnalysisJobsContext";
import { WithdrawAccountModal } from "@/components/WithdrawAccountModal";

/** 공지(클립보드 목록) 아이콘 */
function NoticeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

type AppShellHeaderClientProps = {
  email: string;
  natBalance: number;
};

export function AppShellHeaderClient({
  email,
  natBalance,
}: AppShellHeaderClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  // hydration 안정성: useId()는 서버/클라 트리 불일치 시 aria-controls mismatch 경고가 날 수 있어
  // 헤더의 단일 패널은 고정 id를 사용한다.
  const panelId = "app-shell-menu-panel";

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 shrink-0 border-b border-cyan-500/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="truncate text-lg font-bold tracking-tight text-zinc-100"
            >
              {SITE_NAME}
            </Link>
            <Link
              href="/studio"
              className="hidden shrink-0 text-sm font-medium text-cyan-200 sm:inline"
            >
              스튜디오
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/billing"
              className="rounded-lg border border-cyan-500/30 bg-cyan-950/35 px-2.5 py-1.5 text-xs tabular-nums text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-950/50 sm:px-3 sm:text-sm"
            >
              {natBalance.toLocaleString("ko-KR")} NAT
            </Link>
            <HeaderAnalysisBell />
            <Link
              href="/notices"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-cyan-200"
              aria-label="공지사항"
              title="공지사항"
            >
              <NoticeIcon className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
              aria-expanded={menuOpen}
              aria-controls={panelId}
              aria-label="메뉴 열기"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* z-50 문의 FAB보다 위, z-[60] 문의 패널보다 아래 — 오버레이로 FAB 가림(언마운트 불필요) */}
      {menuOpen && (
        <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id={panelId}
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-100">메뉴</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="닫기"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                로그인 계정
              </p>
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-cyan-500/30 hover:bg-zinc-900/80 hover:text-zinc-100"
              >
                <span className="break-all">{email}</span>
                <span className="shrink-0 text-xs text-cyan-400/90">
                  내 계정 →
                </span>
              </Link>
              <nav className="mt-4 flex flex-col gap-1 border-t border-zinc-800 pt-4">
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  마이페이지
                </Link>
                <Link
                  href="/account/inquiries"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  내 문의
                </Link>
                <Link
                  href="/studio"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  스튜디오
                </Link>
                <Link
                  href="/notices"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  공지사항
                </Link>
                <Link
                  href="/billing"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  NAT 충전
                </Link>
                <Link
                  href="/terms"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                >
                  이용약관
                </Link>
              </nav>
            </div>
            <div className="border-t border-zinc-800 p-4 space-y-2">
              <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                className="w-full rounded-lg border border-red-600/70 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 transition-colors hover:border-red-500 hover:bg-red-950/60"
              >
                회원 탈퇴
              </button>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-zinc-600 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                >
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <WithdrawAccountModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </>
  );
}
