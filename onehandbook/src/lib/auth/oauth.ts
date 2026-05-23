"use client";

import { createClient } from "@/lib/supabase/client";
import { getOAuthRedirectBaseForBrowser } from "@/lib/oauthRedirectBase";
import {
  OHB_REMEMBER_ME_LS_KEY,
  setClientPersistencePreferenceCookie,
} from "@/lib/supabase/authPersistence";

export type OAuthProvider = "google" | "naver";

/**
 * Remember Me 선호 박음 — cookie + localStorage 동시 적용.
 * SiteHeader 의 LoginModal 진입 흐름이 별 prop 박지 않도록 util 안에 묶음.
 * (LoginPageClient.tsx 의 persistSessionPreference 와 동일 패턴)
 */
function persistSessionPreference(): void {
  setClientPersistencePreferenceCookie(true);
  try {
    localStorage.setItem(OHB_REMEMBER_ME_LS_KEY, "1");
  } catch {
    /* ignore — Safari private 모드 등 localStorage 차단 환경 */
  }
}

/**
 * 다른 OAuth (구글 ↔ 네이버) 연속 시도 시 Supabase 세션 / PKCE 잔여를 로컬만 정리.
 * 서버 세션 박힌 채 유지 — 진행 중 흐름이 깨지지 않도록.
 */
async function clearLocalAuthBeforeOAuth(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {
    /* ignore */
  });
}

export interface SignInWithGoogleOptions {
  /**
   * 서버 props 박힌 redirectBase (예: LoginPageClient 의 oauthRedirectBase) 가
   * 있으면 우선 박음. 없으면 client 측 base 박음.
   */
  oauthRedirectBase?: string;
}

export async function signInWithGoogle(
  opts: SignInWithGoogleOptions = {},
): Promise<void> {
  persistSessionPreference();
  await clearLocalAuthBeforeOAuth();
  const callbackBase =
    (opts.oauthRedirectBase ?? "").trim() || getOAuthRedirectBaseForBrowser();
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${callbackBase}/api/auth/oauth-complete?provider=google`,
    },
  });
  if (error) throw error;
}

/**
 * Naver 는 Supabase native 미지원 — custom OAuth flow 박음.
 * /api/auth/naver/start → Naver 인증 → /api/auth/naver/complete → /auth/callback
 */
export async function signInWithNaver(): Promise<void> {
  persistSessionPreference();
  await clearLocalAuthBeforeOAuth();
  if (typeof window !== "undefined") {
    window.location.assign("/api/auth/naver/start");
  }
}

export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  if (provider === "google") {
    await signInWithGoogle();
    return;
  }
  if (provider === "naver") {
    await signInWithNaver();
    return;
  }
  const _exhaustive: never = provider;
  throw new Error(`Unsupported OAuth provider: ${String(_exhaustive)}`);
}
