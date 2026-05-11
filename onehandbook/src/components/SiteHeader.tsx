import Link from "next/link";
import { SITE_NAME } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 pt-6 lg:px-12 lg:pt-7">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-300/90 to-sky-500/80 text-stone-950">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </span>
        <span>
          <span className="block text-[14px] font-medium tracking-tight text-stone-100">
            {SITE_NAME}
          </span>
          <span className="block text-[10px] text-stone-400">
            웹소설 흥행 분석
          </span>
        </span>
      </Link>
      <nav className="hidden items-center gap-7 text-[12.5px] text-stone-400 md:flex">
        <a href="#features" className="hover:text-stone-100">
          기능
        </a>
        <a href="#sample" className="hover:text-stone-100">
          분석 샘플
        </a>
        <Link href="/pricing" className="hover:text-stone-100">
          요금
        </Link>
        <span
          aria-disabled="true"
          title="준비 중"
          className="cursor-not-allowed text-stone-500/60 opacity-60"
        >
          FAQ
        </span>
        <span className="h-4 w-px bg-stone-800" aria-hidden="true" />
        <Link
          href="/login"
          className="text-stone-400 hover:text-stone-100"
        >
          로그인
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-sky-400 px-3.5 py-1.5 text-[12px] font-medium text-stone-950 hover:bg-sky-300"
        >
          무료로 시작
        </Link>
      </nav>
      {/* 모바일 헤더 액션 — nav 축약 */}
      <Link
        href="/login"
        className="rounded-md bg-sky-400 px-3.5 py-1.5 text-[12px] font-medium text-stone-950 hover:bg-sky-300 md:hidden"
      >
        무료로 시작
      </Link>
    </header>
  );
}
