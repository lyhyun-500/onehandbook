"use client";

/**
 * login-preview — 페이즈 2-C-2 LoginModal 시각 검증 페이지.
 * /dev/* 는 proxy.ts 의 production 차단 정책 적용 — production 빌드에서 redirect.
 *
 * 박힌 컴포넌트:
 * - LoginModal (2-C-2) — 비로그인 헤더의 "로그인" 버튼 클릭 시 노출 모달.
 *
 * 시각 검증 게이트:
 * - backdrop blur (stone-950/70 + backdrop-blur-sm)
 * - card border / shadow / bg stone-900/95
 * - mark sky 그라데이션 박스 + BookOpen icon
 * - 소셜 버튼 brand 색 (Google + Naver)
 * - footer 묵시 동의 텍스트
 * - ESC 닫기 / backdrop click 닫기 / 포커스 복원
 *
 * 실 wiring (Supabase OAuth) 은 페이즈 2-C-3 박음 — 본 페이지는 console.log noop.
 */

import { useState } from "react";
import { LoginModal, type LoginProvider } from "@/components/auth/LoginModal";

export default function LoginPreviewPage() {
  const [open, setOpen] = useState(true);

  const handleLogin = (provider: LoginProvider) => {
    console.log("[login-preview] provider:", provider);
  };

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-stone-950 text-stone-200">
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
            login preview (페이즈 2-C-2)
          </h1>
          <p className="text-sm text-stone-400">
            LoginModal 단독 시각 검증 — 시안의 backdrop blur + card stone-900/95
            + Google / Naver 버튼 적용.
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 rounded-md border border-stone-700 bg-stone-900 px-4 py-2 text-[12px] text-stone-200 hover:bg-stone-800"
          >
            {open ? "모달 닫기" : "모달 열기"}
          </button>
        </header>

        <LoginModal
          open={open}
          onClose={() => setOpen(false)}
          onLogin={handleLogin}
        />
      </div>
    </div>
  );
}
