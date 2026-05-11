"use client";

/**
 * login-spinner-preview — 페이즈 2-C-4 LoginSpinner 시각 검증 페이지.
 * /dev/* 는 proxy.ts 의 production 차단 정책 적용.
 *
 * 박힌 컴포넌트:
 * - LoginSpinner (2-C-4) — /auth/callback 박힌 인증 transitional UI.
 *
 * 시각 검증 게이트:
 * - 다크 톤 일관 (배경 stone-950)
 * - svg 로고 박힘 (height 48, LoginModal 정합)
 * - spinner RAF rotate (na-spin keyframe)
 * - 3-stage progress (auth → profile → workspace)
 *   - 현재 stage = sky-300 + na-pulse animation
 *   - 완료 stage = emerald-300 + ✓ + connector emerald-400/40
 *   - 대기 stage = stone-600 + connector stone-800
 * - 라벨 / sub / hint 텍스트 위계
 *
 * 실 /auth/callback 흐름 = 단일 stage "auth" (즉시 redirect 박혀서 profile/workspace
 * 시각 노출 0). 본 preview 는 컴포넌트 자체 시각 검증 박음.
 */

import { useState } from "react";
import { LoginSpinner, type LoginStage } from "@/components/auth/LoginSpinner";

const STAGES: LoginStage[] = ["auth", "profile", "workspace"];

export default function LoginSpinnerPreviewPage() {
  const [stage, setStage] = useState<LoginStage>("auth");

  return (
    <div className="relative min-h-screen w-full bg-stone-950 text-stone-200">
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-1.5 rounded-md border border-stone-700 bg-stone-900/95 p-3 text-[11px]">
        <div className="text-stone-400">stage 토글</div>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className={`rounded px-2 py-1 text-left ${
              stage === s
                ? "bg-sky-400/20 text-sky-300"
                : "text-stone-300 hover:bg-stone-800"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <LoginSpinner stage={stage} />
    </div>
  );
}
