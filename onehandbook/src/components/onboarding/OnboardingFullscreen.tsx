"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NatChip } from "@/components/atoms/NatChip";
import { SampleAnalysisReport } from "@/components/onboarding/SampleAnalysisReport";

interface OnboardingFullscreenProps {
  /** supabase auth_id (RLS user lookup). */
  authId: string;
}

/**
 * 신규 작가 온보딩 (05A) 풀스크린.
 *
 * 시안 design_novel/novel-agent/portfolio-canvas.jsx OnboardingFullscreen 포팅.
 *
 * 닫기 트리거 4종 (모두 onClose 핸들러 호출):
 *   1. 「시작하기 1/1」 close X (헤더 우측)
 *   2. 「건너뛰기」 (헤더 우측)
 *   3. 「내 작품으로 시작하기」 (Hero CTA primary)
 *   4. 「둘러보고 결정할게요」 (Hero CTA secondary)
 *
 * onClose → users.onboarding_seen_at = now() UPDATE + /studio router.push.
 */
export function OnboardingFullscreen({ authId }: OnboardingFullscreenProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleClose = async () => {
    try {
      await supabase
        .from("users")
        .update({ onboarding_seen_at: new Date().toISOString() })
        .eq("auth_id", authId);
    } catch (e) {
      // silent fail — 갱신 실패해도 사용자 진입은 막지 않음
      console.warn("[Onboarding] mark seen failed", e);
    }
    router.push("/studio");
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
            시작하기 1/1
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-stone-400">
          <button
            type="button"
            onClick={handleClose}
            className="text-stone-500 hover:text-stone-300"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="온보딩 닫기"
            className="flex h-7 w-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100/[0.04] hover:text-stone-200"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
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
          에이전트가 한 회차를 어떻게 읽는지,{" "}
          <span className="italic text-stone-400">먼저 보여드릴게요.</span>
        </h1>
        <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-stone-400">
          아래는 다른 작가의 회차로 돌려본 실제 분석 결과입니다. 6개 축 점수, 개선
          포인트, 유사작 비교를 둘러본 뒤 내 작품으로 시작하세요.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
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
            둘러보고 결정할게요
          </button>
          <span className="ml-2 inline-flex items-center gap-1.5 text-[11.5px] text-stone-500">
            <NatChip amount={20} size="sm" /> 가입 보너스 지급 완료
          </span>
        </div>
      </section>

      <section className="overflow-hidden">
        <div
          className="origin-top-left"
          style={{
            transform: "scale(0.78)",
            width: `${100 / 0.78}%`,
          }}
        >
          <SampleAnalysisReport />
        </div>
      </section>
    </div>
  );
}
