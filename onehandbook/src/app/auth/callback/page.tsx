"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LoginSpinner, type LoginStage } from "@/components/auth/LoginSpinner";

const STAGE_SEQUENCE: LoginStage[] = ["auth", "profile", "workspace"];
const STAGE_DURATION_MS = 1500;

/**
 * OAuth callback — Google / Naver 콜백 진입점.
 *
 * 발견 11 정정 (fixup 8a): 3단계 시뮬을 본 페이지에 직접 통합.
 * 이전엔 /auth/spinner transient page 로 분기했으나, 신규/재로그인 사용자
 * 동등 노출 위해 callback page 안 시뮬 → 완료 시 oauth-complete 진입.
 * 즉 시뮬 4.5초는 pure 시각 노출이며, oauth-complete PKCE 교환은 시뮬 종료 후 동기 처리.
 */
function AuthCallbackLoadingPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<LoginStage>("auth");

  const code = searchParams.get("code");
  const provider = searchParams.get("provider");

  useEffect(() => {
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("로그인 코드가 없습니다. 다시 시도해 주세요.");
      return;
    }
    const q = new URLSearchParams({ code });
    if (provider) q.set("provider", provider);
    const oauthCompleteUrl = `/api/auth/oauth-complete?${q.toString()}`;

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage("profile"), STAGE_DURATION_MS));
    timers.push(setTimeout(() => setStage("workspace"), STAGE_DURATION_MS * 2));
    timers.push(
      setTimeout(() => {
        // PKCE 쿠키가 fetch POST 에서 누락되는 경우가 있어, 동일 origin GET 으로 서버에서 교환
        window.location.replace(oauthCompleteUrl);
      }, STAGE_DURATION_MS * STAGE_SEQUENCE.length),
    );
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [code, provider]);

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-stone-950 px-6 text-stone-200">
        <Image
          src="/logo.svg"
          alt="Novel Agent"
          width={68}
          height={48}
          priority
        />
        <p
          className="mt-7 max-w-sm rounded-lg bg-red-500/10 px-4 py-3 text-center text-[13px] text-red-300"
          aria-live="polite"
        >
          {error}
        </p>
        <Link
          href="/"
          className="mt-5 text-[12px] text-stone-400 underline-offset-2 hover:text-sky-200 hover:underline"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return <LoginSpinner stage={stage} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoginSpinner stage="auth" />}>
      <AuthCallbackLoadingPage />
    </Suspense>
  );
}
