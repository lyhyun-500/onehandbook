import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  adjustAuthCookiesForPersistence,
  isPersistentAuthFromCookieValue,
  OHB_AUTH_PERSISTENT_COOKIE,
} from "@/lib/supabase/authPersistence";

const OHB_SESSION_HINT_COOKIE = "ohb_session_hint";

function hasSupabaseAuthCookies(request: NextRequest): boolean {
  const cookies = request.cookies.getAll();
  return cookies.some((c) => {
    const n = c.name;
    // Next.js SSR helper가 설정하는 supabase auth cookie들(프로젝트별 prefix 포함)
    return (
      n.includes("auth-token") ||
      n.includes("sb-") ||
      n.includes("supabase")
    );
  });
}

/**
 * Supabase SSR: `setAll`에 `options`까지 넘겨야 세션 갱신 쿠키가 브라우저에 반영됩니다.
 * 누락 시 보호 페이지 이동 시 세션이 비어 로그인으로 튕기는 현상이 날 수 있습니다.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  /** 예전 북마크: /dashboard → /studio */
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    const next =
      path === "/dashboard"
        ? "/studio"
        : `/studio${path.slice("/dashboard".length)}`;
    return NextResponse.redirect(new URL(next, request.url));
  }

  /** 1차: 공개 매대(/explore) 비활성 — 개인용 분석 툴만 제공 */
  if (path === "/explore" || path.startsWith("/explore/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const hint = request.cookies.get(OHB_SESSION_HINT_COOKIE)?.value === "1";
  const hasAuthCookie = hasSupabaseAuthCookies(request);

  const persistent = isPersistentAuthFromCookieValue(
    request.cookies.get(OHB_AUTH_PERSISTENT_COOKIE)?.value
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const adjusted = adjustAuthCookiesForPersistence(
            cookiesToSet,
            persistent
          );
          adjusted.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options ?? {});
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  // 세션 힌트 쿠키가 있고 auth 쿠키도 있으면, 매 네비게이션마다 네트워크 getUser를 하지 않습니다.
  // (토큰 만료 등은 다음 갱신 시점/보호 API에서 걸립니다)
  let user: unknown = null;
  if (hint && hasAuthCookie) {
    user = { hinted: true };
  } else {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
    if (u) {
      response.cookies.set(OHB_SESSION_HINT_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
        sameSite: "lax",
      });
    } else if (hint) {
      response.cookies.set(OHB_SESSION_HINT_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });
    }
  }

  if (path === "/" && user) {
    const redirectResponse = NextResponse.redirect(
      new URL("/studio", request.url)
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  const isProtected =
    path.startsWith("/studio") ||
    path.startsWith("/works") ||
    path.startsWith("/billing") ||
    path.startsWith("/notices") ||
    path === "/verify-phone";

  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(
      new URL("/login", request.url)
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 자산 제외한 모든 경로에서 세션 갱신(프록시 1회).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
