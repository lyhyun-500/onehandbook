"use client";

/**
 * landing-preview — 페이즈 2-B landing 컴포넌트 시각 검증 페이지.
 * /dev/* 는 proxy.ts 의 production 차단 정책 적용 — production 빌드에서 redirect.
 *
 * 박힌 컴포넌트:
 * - LiveScoreCard (2-B-3) — 비로그인 랜딩의 라이브 점수 데모 카드.
 *
 * 시각 검증 게이트:
 * - 점수 변화 부드러움 (RAF lerp 6%)
 * - 5초 interval (점수 자동 변경)
 * - 6축 막대그래프 박힘 + oklch 보간
 * - 종합 점수 톤 swap
 * - LIVE 배지 ping
 *
 * 시안의 다크 작업실 톤 박음 — bg-stone-950 + radial gradient (시안 LandingPage 박음).
 */

import { LiveScoreCard } from "@/components/landing/LiveScoreCard";

export default function LandingPreviewPage() {
  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-stone-950 text-stone-200">
      {/* 시안 LandingPage 의 ambient gradient 박음 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(60% 100% at 30% 0%, oklch(0.30 0.06 240 / 0.35) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-12 py-16">
        <header className="mb-10 space-y-2">
          <h1 className="font-serif text-2xl text-stone-100">
            landing preview (페이즈 2-B)
          </h1>
          <p className="text-sm text-stone-400">
            LiveScoreCard 단독 시각 검증 — RAF lerp 6% / 5초 interval / 6축
            동시 박음. ADR-0024 결정 13 박음.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-[11px] tracking-widest text-sky-300/85">
            LiveScoreCard
          </h2>
          <LiveScoreCard />
        </section>
      </div>
    </div>
  );
}
