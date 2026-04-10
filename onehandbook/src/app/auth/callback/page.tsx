"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";

const MESSAGES = [
  "스튜디오 불러오는 중...",
  "펜에 잉크 채우는 중..",
  "맞춤법 검수중..",
] as const;

function Spinner() {
  return (
    <div
      className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400"
      role="status"
      aria-label="로딩 중"
    />
  );
}

function AuthCallbackLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const code = searchParams.get("code");
  const provider = searchParams.get("provider");

  const message = useMemo(() => MESSAGES[idx % MESSAGES.length], [idx]);

  useEffect(() => {
    const t = window.setInterval(() => setIdx((v) => v + 1), 3000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!code) {
        setError("로그인 코드가 없습니다. 다시 시도해 주세요.");
        return;
      }
      try {
        const q = new URLSearchParams({ code });
        if (provider) q.set("provider", provider);
        const res = await fetch(`/api/auth/exchange?${q.toString()}`, {
          method: "POST",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || data.ok !== true) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "로그인 처리에 실패했습니다."
          );
        }
        if (cancelled) return;
        router.replace("/studio");
        router.refresh();
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "로그인 처리에 실패했습니다.");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [code, provider, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-10 text-center shadow-xl backdrop-blur-sm">
        <p className="text-2xl font-bold tracking-tight text-zinc-100">
          {SITE_NAME}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Novel Agent</p>

        <div className="mt-8 flex justify-center">
          <Spinner />
        </div>

        {!error ? (
          <p className="mt-5 text-sm text-zinc-400" aria-live="polite">
            {message}
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              로그인 페이지로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-10 text-center shadow-xl backdrop-blur-sm">
            <p className="text-2xl font-bold tracking-tight text-zinc-100">
              {SITE_NAME}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Novel Agent</p>
            <div className="mt-8 flex justify-center">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400"
                role="status"
                aria-label="로딩 중"
              />
            </div>
            <p className="mt-5 text-sm text-zinc-400" aria-live="polite">
              스튜디오 불러오는 중...
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackLoadingPage />
    </Suspense>
  );
}

