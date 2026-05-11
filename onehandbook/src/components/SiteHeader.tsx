import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 pt-6 lg:px-12 lg:pt-7">
      <Link
        href="/"
        aria-label="Novel Agent — 홈"
        className="inline-flex items-center"
      >
        <Image
          src="/logo.svg"
          alt="Novel Agent"
          width={68}
          height={48}
          priority
        />
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
