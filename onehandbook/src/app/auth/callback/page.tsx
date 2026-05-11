"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LoginSpinner } from "@/components/auth/LoginSpinner";

function AuthCallbackLoadingPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

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
    // PKCE 쿠키가 fetch POST 에서 누락되는 경우가 있어, 동일 origin GET 으로 서버에서 교환
    window.location.replace(`/api/auth/oauth-complete?${q.toString()}`);
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

  return <LoginSpinner stage="auth" />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoginSpinner stage="auth" />}>
      <AuthCallbackLoadingPage />
    </Suspense>
  );
}
