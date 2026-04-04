import Link from "next/link";
import { Noto_Sans_KR } from "next/font/google";
import { LandingCoverDrift } from "@/components/LandingCoverDrift";
import { SITE_NAME } from "@/config/site";
import { getLandingCoverBackdrop } from "@/lib/landing-covers";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const genreCards = [
  { genre: "로맨스", score: 86, hint: "최근 분석 평균" },
  { genre: "판타지", score: 81, hint: "최근 분석 평균" },
  { genre: "무협", score: 79, hint: "최근 분석 평균" },
  { genre: "현대물", score: 84, hint: "최근 분석 평균" },
] as const;

export default async function HomePage() {
  const coverBackdrop = await getLandingCoverBackdrop();

  return (
    <div
      className={`${notoSansKr.className} flex min-h-screen flex-col gap-0 bg-[#000000] text-zinc-100`}
    >
      <header className="sticky top-0 z-30 m-0 shrink-0 border-b border-white/[0.06] bg-[#000000]/90 p-0 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

      <section className="relative isolate m-0 mt-0 h-[100vh] max-h-[100vh] min-h-0 w-full shrink-0 overflow-hidden p-0 pt-0">
        <LandingCoverDrift data={coverBackdrop} />
        <div
          className="pointer-events-none absolute -right-32 top-1/4 z-[2] h-[480px] w-[480px] rounded-full bg-cyan-500/[0.06] blur-[120px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-0 z-[2] h-[360px] w-[360px] rounded-full bg-cyan-400/[0.04] blur-[100px]"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute inset-0 z-[6] bg-gradient-to-b from-black/38 via-black/28 to-black/38"
          aria-hidden
        />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-0">
          <div className="pointer-events-auto mx-auto flex w-full max-w-7xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-center lg:gap-16 xl:gap-24">
            <div className="flex-1 lg:max-w-xl xl:max-w-2xl">
            <h1 className="text-[clamp(1.875rem,5vw,3.5rem)] font-black leading-[1.12] tracking-[-0.03em] text-white">
              당신의 원고,
              <br />
              흥행작이 될 수 있습니다.
            </h1>
            <p className="mt-8 text-lg font-semibold leading-relaxed text-zinc-400 md:text-xl md:leading-relaxed">
              네이버 시리즈·카카오페이지·문피아 맞춤 AI 에이전트
            </p>
            <div className="mt-10">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-cyan-400 px-10 py-3 text-base font-bold text-[#000000] shadow-[0_0_40px_-8px_rgba(34,211,238,0.55)] transition-[background-color,box-shadow] hover:bg-cyan-300 hover:shadow-[0_0_48px_-6px_rgba(34,211,238,0.65)]"
              >
                지금 시작하기
              </Link>
            </div>
            </div>

            <div className="flex-1 lg:max-w-md xl:max-w-lg">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              장르별 최근 분석 점수
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {genreCards.map(({ genre, score, hint }) => (
                <div
                  key={genre}
                  className="rounded-xl border border-white/[0.08] bg-[#141414]/90 p-5 shadow-black/20 backdrop-blur-sm sm:p-6"
                >
                  <p className="text-sm font-bold text-zinc-300">{genre}</p>
                  <p
                    className="mt-3 font-black tabular-nums tracking-tight text-white"
                    style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)" }}
                  >
                    {score}
                    <span className="ml-0.5 text-lg font-extrabold text-zinc-500">
                      점
                    </span>
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-500">
                    {hint}
                  </p>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
