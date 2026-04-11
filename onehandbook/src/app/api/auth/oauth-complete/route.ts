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

  const res = NextResponse.redirect(new URL("/studio", url.origin));
  res.cookies.set(OHB_SESSION_HINT_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
  });
  return res;
}
