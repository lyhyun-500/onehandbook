import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser, setUserLoginProvider } from "@/lib/supabase/appUser";

const OHB_SESSION_HINT_COOKIE = "ohb_session_hint";

function resolveProvider(raw: string | null): "google" | "naver" | null {
  if (raw === "google" || raw === "naver") return raw;
  return null;
}

/**
 * Google PKCE: 브라우저가 이 GET으로 직접 들어오면 쿠키가 요청에 실려
 * `exchangeCodeForSession`이 안정적으로 동작한다(클라이언트 fetch 보다 유리).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const provider = resolveProvider(url.searchParams.get("provider"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=oauth&detail=" + encodeURIComponent("missing_code"), url.origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const detail = encodeURIComponent(error.message || "exchange_failed");
    return NextResponse.redirect(
      new URL(`/login?error=oauth&detail=${detail}`, url.origin)
    );
  }

  after(async () => {
    try {
      await syncAppUser(supabase);
      if (provider) await setUserLoginProvider(supabase, provider);
    } catch (e) {
      console.warn("oauth-complete post-login:", e);
    }
  });

  // P-2-2b 분기 (발견 7): 신규 가입자(onboarding_seen_at IS NULL) → /auth/spinner 시뮬 4.5초 후 /studio.
  // 재로그인 사용자(NOT NULL) → /studio 직접 redirect (시뮬 미노출, 현 동작 유지).
  // exchangeCodeForSession + after(syncAppUser) 코드 path 변경 0 — redirect URL 만 분기.
  let redirectPath = "/studio";
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: userRow } = await supabase
        .from("users")
        .select("onboarding_seen_at")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (userRow && userRow.onboarding_seen_at == null) {
        redirectPath = "/auth/spinner?next=/studio";
      }
    }
  } catch (e) {
    // silent fail — 조회 실패 시 /studio 직접 redirect (현 동작 fallback)
    console.warn("oauth-complete onboarding branch:", e);
  }

  const res = NextResponse.redirect(new URL(redirectPath, url.origin));
  res.cookies.set(OHB_SESSION_HINT_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
  });
  return res;
}
