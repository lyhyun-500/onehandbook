import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  adjustAuthCookiesForPersistence,
  isPersistentAuthFromCookieValue,
  OHB_AUTH_PERSISTENT_COOKIE,
} from "@/lib/supabase/authPersistence";

/**
 * Supabase SSR: `setAll`에 `options`까지 넘겨야 세션 갱신 쿠키가 브라우저에 반영됩니다.
 * 누락 시 보호 페이지 이동 시 세션이 비어 로그인으로 튕기는 현상이 날 수 있습니다.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  /** 1차: 공개 매대(/explore) 비활성 — 개인용 분석 툴만 제공 */
  if (path === "/explore" || path.startsWith("/explore/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path === "/" && user) {
    const redirectResponse = NextResponse.redirect(
      new URL("/dashboard", request.url)
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  const isProtected =
    path.startsWith("/dashboard") ||
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
     * 정적 자산 제외한 모든 경로에서 세션 갱신(미들웨어 1회).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
