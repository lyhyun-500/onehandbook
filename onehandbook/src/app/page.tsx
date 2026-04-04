import Image from "next/image";
import Link from "next/link";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { SITE_NAME } from "@/config/site";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 shrink-0 border-b border-cyan-500/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-zinc-100"
          >
            {SITE_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-950/70"
            >
              로그인
            </Link>
          </nav>
        </div>
      </header>

      {/* 높이 = 100svh − 헤더(약 4.75rem) — 이미지가 네비에 가리지 않음 */}
      <section className="relative isolate w-full min-h-[calc(100svh-4.75rem)] flex-1 md:min-h-[calc(100svh-5rem)]">
        <Image
          src="/images/novel-agent-hero.png"
          alt="NOVEL AGENT — 웹소설 AI 분석"
          fill
          className="object-cover object-[center_18%] sm:object-[center_22%]"
          sizes="100vw"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-zinc-950/50"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-3xl px-6 pb-12 pt-24 text-center sm:pb-16 sm:pt-28">
          <h1 className="mb-4 text-3xl font-bold leading-tight text-white drop-shadow-md sm:text-4xl">
            내 원고에 맞춘 흥행 분석
            <br />
            개인 에이저트를 활용해보세요.
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-zinc-200 sm:text-base">
            <CopyWithBreaks as="span" className="block">
              작가의 강점에 따라 카카오페이지·문피아·네이버 시리즈 관점과 장르·세계관 설정을 반영합니다.
            </CopyWithBreaks>
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href="/login"
              className="rounded-lg bg-cyan-500 px-8 py-3 text-center text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
            >
              로그인하고 시작하기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
