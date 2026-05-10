import Link from "next/link";
import { SITE_NAME } from "@/config/site";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col gap-0 bg-[#000000] text-zinc-100">
      <header className="fixed inset-x-0 top-0 z-30 m-0 min-h-[var(--ohb-landing-header-h)] border-b border-white/[0.06] bg-[#000000]/90 p-0 backdrop-blur-md">
        <div className="mx-auto flex h-full min-h-[var(--ohb-landing-header-h)] max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-extrabold tracking-tight text-white"
          >
            {SITE_NAME}
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-md border border-white/10 px-4 py-2 font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              로그인
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative m-0 h-auto min-h-[100dvh] w-full shrink-0 overflow-hidden p-0 lg:h-[100vh] lg:isolate">
        <div
          className="relative z-[2] flex h-full min-h-0 items-center justify-center px-6 py-0 lg:absolute lg:inset-0 lg:z-[2] lg:min-h-0 lg:!pt-[var(--ohb-landing-header-h)]"
          style={{
            paddingTop:
              "max(env(safe-area-inset-top, 0px), var(--ohb-landing-header-h))",
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4rem)",
          }}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-center lg:gap-16 xl:gap-24">
            <div className="flex-1 lg:max-w-xl xl:max-w-2xl">
              <h1 className="text-[clamp(1.875rem,5vw,3.5rem)] font-black leading-[1.12] tracking-[-0.03em] text-white">
                당신의 원고,
                <br />
                흥행작이 될 수 있습니다.
              </h1>
              <p className="mt-8 text-lg font-semibold leading-relaxed text-zinc-400 md:text-xl md:leading-relaxed">
                장르·연재 맥락에 맞춘 AI 흥행 분석
              </p>
              <div className="mt-10">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-cyan-400 px-10 py-3 text-base font-bold text-[#000000] shadow-[0_0_40px_-8px_rgba(34,211,238,0.55)] transition-[background-color,box-shadow] hover:bg-cyan-300 hover:shadow-[0_0_48px_-6px_rgba(34,211,238,0.65)]"
                >
                  지금 시작하기
                </Link>
                <p className="mt-3 text-xs font-medium text-zinc-500">
                  🔒 원고는 외부에 절대 공개되지 않으며 · AI 학습에 사용되지 않습니다
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
