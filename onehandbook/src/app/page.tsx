import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LiveScoreCard } from "@/components/landing/LiveScoreCard";

const FEATURE_BLOCKS: { kicker: string; title: string; body: string; accent: string }[] = [
  {
    kicker: "01",
    title: "장르별 전문 에이전트",
    body: "로맨스 판타지, 무협, 현대 판타지 — 장르마다 흥행 문법이 다릅니다. 장르에 맞춰 훈련된 에이전트가 회차를 분석합니다.",
    accent: "bg-sky-400/40",
  },
  {
    kicker: "02",
    title: "6개 축, 정량 점수",
    body: "도입 후킹 · 캐릭터 매력 · 갈등 구조 · 전개 속도 · 세계관 일관성 · 문장 가독성. 추상적인 합평이 아니라 비교 가능한 수치.",
    accent: "bg-amber-400/40",
  },
  {
    kicker: "03",
    title: "유사 흥행작 매칭",
    body: "같은 장르 상위 1% 작품의 회차 패턴과 비교. 어디서 독자가 이탈할지, 어떤 장면을 보강할지 구체적으로.",
    accent: "bg-emerald-400/40",
  },
];

const HOW_STEPS: { n: string; t: string; d: string }[] = [
  { n: "1", t: "작품 등록", d: "장르·시점·주인공 키워드만 입력" },
  { n: "2", t: "회차 붙여넣기", d: "에피소드 텍스트를 그대로 업로드" },
  { n: "3", t: "에이전트 분석", d: "장르 모델이 평균 42초 안에 채점" },
  { n: "4", t: "코멘트 받기", d: "축별 점수 + 개선 포인트 + 유사작" },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-stone-950 text-stone-200">
      {/* ambient radial gradient — 시안 line 179-181 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(60% 100% at 30% 0%, oklch(0.30 0.06 240 / 0.35) 0%, transparent 60%)",
        }}
      />

      <div className="relative">
        <SiteHeader />

        <main>
        {/* HERO */}
        <section className="px-6 pt-12 pb-16 lg:px-12 lg:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <div>
              <h1 className="font-serif text-[40px] font-medium leading-[1.05] tracking-tight text-stone-100 sm:text-[48px] lg:text-[58px]">
                내 작품이
                <br />
                흥행할지,
                <br />
                <span className="italic text-stone-300">
                  에이전트가 먼저 읽습니다.
                </span>
              </h1>
              <p className="mt-6 max-w-[460px] font-serif text-[15px] leading-relaxed text-stone-400 lg:text-[16px]">
                웹소설 작가를 위한 AI 흥행 분석 도구. 회차를 업로드하면 장르 전문
                에이전트가 6개 축으로 점수를 매기고, 개선 포인트를 코멘트로
                돌려줍니다.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-md bg-sky-400 px-5 py-2.5 text-[13.5px] font-medium text-stone-950 hover:bg-sky-300"
                >
                  가입하고 20 NAT 받기
                </Link>
                <a
                  href="#sample"
                  className="rounded-md border border-stone-800 bg-stone-900/40 px-5 py-2.5 text-[13.5px] text-stone-200 hover:border-stone-700"
                >
                  분석 샘플 보기 →
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-stone-400">
                <span>베타 운영 중 · 가입 즉시 <span className="text-stone-300 tabular-nums">20 NAT</span></span>
                <span className="hidden h-3 w-px bg-stone-800 sm:inline-block" aria-hidden="true" />
                <span>장르별 에이전트 <span className="text-stone-300 tabular-nums">6종</span> · 6축 분석</span>
                <span className="hidden h-3 w-px bg-stone-800 sm:inline-block" aria-hidden="true" />
                <span>평균 분석 시간 <span className="text-stone-300">42초</span></span>
              </div>
            </div>

            <div id="sample">
              <LiveScoreCard />
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section
          id="features"
          className="border-t border-stone-800/60 px-6 py-16 lg:px-12 lg:py-20"
        >
          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] tracking-widest text-sky-300/85">
                왜 NOVEL AGENT 인가
              </div>
              <h2 className="mt-2 font-serif text-[28px] leading-tight text-stone-100 lg:text-[34px]">
                합평이 아니라 데이터.
                <br />
                <span className="text-stone-400 italic">감이 아니라 패턴.</span>
              </h2>
            </div>
            <p className="max-w-[360px] text-[12.5px] leading-relaxed text-stone-400">
              플랫폼 출간 전 작가가 가장 알고 싶은 것 — &ldquo;이 회차가
              통할까?&rdquo; 를 정량으로 답합니다.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-stone-800/80 bg-stone-800/60 md:grid-cols-3">
            {FEATURE_BLOCKS.map((f) => (
              <div key={f.kicker} className="bg-stone-950/60 p-7">
                <div className="font-mono text-[10px] tracking-widest text-stone-400">
                  {f.kicker}
                </div>
                <h3 className="mt-3 font-serif text-[20px] text-stone-100">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-stone-400">
                  {f.body}
                </p>
                <div className={`mt-6 h-px w-10 ${f.accent}`} />
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-stone-800/60 px-6 py-16 lg:px-12 lg:py-20">
          <div className="mb-10">
            <div className="text-[11px] tracking-widest text-sky-300/85">
              사용 흐름
            </div>
            <h2 className="mt-2 font-serif text-[28px] text-stone-100 lg:text-[34px]">
              3분이면 첫 리포트가 나옵니다.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((s, i) => (
              <div
                key={s.n}
                className="relative rounded-lg border border-stone-800/80 bg-stone-900/30 p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-serif text-[28px] leading-none tabular-nums text-stone-400">
                    {s.n}
                  </span>
                  {i < HOW_STEPS.length - 1 && (
                    <span
                      className="hidden h-px w-6 bg-stone-700 lg:inline-block"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="font-serif text-[15px] text-stone-100">
                  {s.t}
                </div>
                <div className="mt-1 text-[11.5px] leading-relaxed text-stone-400">
                  {s.d}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-stone-800/60 px-6 py-20 text-center lg:px-12 lg:py-24">
          <h2 className="mx-auto max-w-[640px] font-serif text-[32px] leading-[1.15] text-stone-100 lg:text-[40px]">
            한 회차를 백 번 고치는 대신,{" "}
            <span className="italic text-stone-400">먼저 데이터를 보세요.</span>
          </h2>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-md bg-sky-400 px-6 py-3 text-[14px] font-medium text-stone-950 hover:bg-sky-300"
          >
            가입하고 20 NAT 받기
          </Link>
          <div className="mt-3 text-[11px] text-stone-400">
            가입 즉시 지급 · 소셜 계정으로 간편 시작
          </div>
        </section>
        </main>
        {/* footer 는 layout.tsx 의 <SiteFooter /> 사용 (사이트 전역 통일) */}
      </div>
    </div>
  );
}
