"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { LoginModal, type LoginProvider } from "@/components/auth/LoginModal";
import { signInWithProvider } from "@/lib/auth/oauth";
import { NatChip } from "@/components/atoms/NatChip";
import { SampleAnalysisReport } from "@/components/onboarding/SampleAnalysisReport";

interface SampleTourClientProps {
  /** /sample server page 에서 supabase.auth.getUser 결과. 비로그인 시 null. */
  initialUser: User | null;
}

/**
 * 비로그인/로그인 동등 접근 샘플 분석 둘러보기 (B-2 신규 라우트).
 *
 * 진입 경로:
 *   - 랜딩 「분석 샘플 보기 →」 / 헤더 「분석 샘플」
 *   - URL 직접 입력 (/sample)
 *
 * Hero 카피 = OnboardingFullscreen 의 Hero 와 동일 패턴 (시각 일관성, 컴포넌트 분리는 안 함 —
 * /onboarding 가드 분기 부담 회피).
 *
 * 「내 작품으로 시작하기」 분기:
 *   - 비로그인 (initialUser null) → LoginModal 표시 → OAuth 완료 → /api/auth/oauth-complete → /studio
 *   - 로그인 (initialUser 있음) → router.push("/studio") 즉시 redirect (LoginModal 어색 회피)
 *
 * 「닫기」 → router.push("/") (랜딩 복귀)
 *
 * SampleAnalysisReport 는 원래 크기 (scale 1.0) — /sample 단독 라우트는 풀 페이지라 압축 불필요.
 * (OnboardingFullscreen 안 0.78 scale 은 풀스크린 안 Hero + 본문 동시 노출용 — 다른 컨텍스트)
 */
export function SampleTourClient({ initialUser }: SampleTourClientProps) {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const isLoggedIn = initialUser !== null;

  const handleStart = () => {
    if (isLoggedIn) {
      router.push("/studio");
    } else {
      setLoginOpen(true);
    }
  };

  const handleClose = () => {
    router.push("/");
  };

  const handleLogin = async (provider: LoginProvider) => {
    try {
      await signInWithProvider(provider);
    } catch (err) {
      console.error("[SampleTour] OAuth error:", err);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-stone-950 text-stone-200">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-stone-800/60 bg-stone-950/90 px-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Novel Agent"
            width={68}
            height={48}
            priority
          />
          <span className="rounded border border-stone-800 bg-stone-900/60 px-1.5 py-0.5 font-mono text-[9.5px] tracking-widest text-sky-200/90">
            샘플 분석 둘러보기
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="샘플 분석 닫기"
          className="flex h-7 w-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100/[0.04] hover:text-stone-200"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <section
        className="relative border-b border-stone-800/60 px-6 pt-10 pb-8 sm:px-12"
        style={{
          background:
            "radial-gradient(800px 200px at 30% 0%, oklch(0.72 0.13 240 / 0.10), transparent 70%)",
        }}
      >
        <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/85">
          샘플 분석 — 황실의 그림자 46화
        </div>
        <h1 className="mt-2 max-w-[820px] font-serif text-[34px] leading-[1.2] tracking-tight text-stone-100">
          에이전트가 한 회차를 어떻게 읽는지,
          <br />
          <span className="italic text-stone-400">먼저 보여드릴게요.</span>
        </h1>
        <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-stone-400">
          아래는 실제 작품이 아닌 임시로 생성된 작품입니다.
          <br />
          6개 축 점수, 개선 포인트, 유사작 비교를 둘러본 뒤 내 작품으로 시작하세요.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-1.5 rounded-md bg-sky-400 px-5 py-2.5 text-[13.5px] font-medium text-stone-950 hover:bg-sky-300"
          >
            <Plus size={13} aria-hidden="true" />
            내 작품으로 시작하기
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-stone-800 bg-stone-900/40 px-5 py-2.5 text-[13.5px] text-stone-300 hover:border-stone-700"
          >
            닫기
          </button>
          {!isLoggedIn && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-stone-500">
              가입 시 <NatChip amount={20} size="sm" /> 지급
            </span>
          )}
        </div>
      </section>

      <section>
        <SampleAnalysisReport />
      </section>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleLogin}
      />
    </div>
  );
}
