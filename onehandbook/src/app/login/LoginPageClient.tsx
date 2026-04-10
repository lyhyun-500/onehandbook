"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { SITE_NAME } from "@/config/site";
import {
  OHB_REMEMBER_ME_LS_KEY,
  setClientPersistencePreferenceCookie,
} from "@/lib/supabase/authPersistence";
import { getOAuthRedirectBaseForBrowser } from "@/lib/oauthRedirectBase";

export type LoginPageClientProps = {
  naverLoginEnabled: boolean;
};

export function LoginPageClient({
  naverLoginEnabled,
}: LoginPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "naver" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "naver") return;
    const detail = params.get("detail");
    setError(
      detail
        ? decodeURIComponent(detail)
        : "네이버 로그인에 실패했습니다."
    );
  }, []);

  const persistSessionPreference = () => {
    setClientPersistencePreferenceCookie(true);
    try {
      localStorage.setItem(OHB_REMEMBER_ME_LS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  /** 다른 OAuth(구글↔네이버)를 연속 시도할 때 남은 Supabase 세션·PKCE 잔여와 섞이지 않게 로컬만 정리 */
  async function clearLocalAuthBeforeOAuth() {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }

  const signInWithGoogle = async () => {
    setLoading(true);
    setLoadingProvider("google");
    setError(null);
    try {
      persistSessionPreference();
      await clearLocalAuthBeforeOAuth();
      // Supabase 허용 목록과 맞추기 위해 개발 시 127.0.0.1 → localhost 통일 (`oauthRedirectBase`).
      const callbackBase = getOAuthRedirectBaseForBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${callbackBase}/auth/callback?provider=google`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google 로그인에 실패했습니다."
      );
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-10 block text-center text-2xl font-bold tracking-tight text-zinc-100"
        >
          {SITE_NAME}
        </Link>

        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-8 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm text-zinc-400">
            소셜 계정으로 로그인하거나 회원가입할 수 있습니다.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-400">
                <CopyWithBreaks as="span">{error}</CopyWithBreaks>
              </p>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={signInWithGoogle}
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-600 bg-zinc-800/80 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Image
                src="/auth/google-signin-icon.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
              {loadingProvider === "google" ? "로그인 중…" : "Google로 계속"}
            </button>

            {naverLoginEnabled && (
              <Link
                href="/api/auth/naver/start"
                onClick={async (e) => {
                  if (e.button !== 0) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  if (loading) return;
                  setLoading(true);
                  setLoadingProvider("naver");
                  setError(null);
                  persistSessionPreference();
                  await clearLocalAuthBeforeOAuth();
                  window.location.assign("/api/auth/naver/start");
                }}
                className={[
                  "relative block w-full overflow-hidden rounded-xl no-underline transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03A94D]",
                  loading
                    ? "pointer-events-none opacity-50"
                    : "hover:opacity-90",
                ].join(" ")}
                aria-busy={loadingProvider === "naver"}
              >
                <Image
                  src="/images/naver-login-kr.jpg"
                  alt="네이버 로그인"
                  width={1024}
                  height={155}
                  className={[
                    "h-auto w-full",
                    loadingProvider === "naver" ? "invisible" : "",
                  ].join(" ")}
                  sizes="(max-width: 448px) 100vw, 448px"
                />
                {loadingProvider === "naver" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/35"
                    aria-live="polite"
                  >
                    <span
                      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/60 border-t-white"
                      aria-hidden
                    />
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          24시간 피드백 가능한 개인 AI 에이전트
        </p>
        <Link
          href="/"
          className="mt-4 block text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← 홈으로
        </Link>
      </div>
    </div>
  );
}
