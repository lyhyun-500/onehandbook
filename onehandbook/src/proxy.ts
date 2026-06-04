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

  /**
   * /dev/* 라우트는 production 에서 차단 (Feature flag 토글 UI 등 개발/preview 한정).
   * Vercel preview 도 NODE_ENV=production 으로 빌드되므로 같이 차단됨.
   * 향후 인증 가드 등으로 확장 시 별도 PR. 지금은 /dev/* 차단만.
   */
  if (path.startsWith("/dev/") && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/", request.url));
  }

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

  const isAdminPath = path === "/admin" || path.startsWith("/admin/");
  const isLoginPath = path.startsWith("/login");
  const isProtectedPath =
    path.startsWith("/studio") ||
    path.startsWith("/works") ||
    path.startsWith("/billing") ||
    path.startsWith("/notices") ||
    path.startsWith("/verify-phone");

  // 세션 힌트 쿠키가 있고 auth 쿠키도 있으면, 매 네비게이션마다 네트워크 getUser를 하지 않습니다.
  // 단:
  //  - /admin 경로는 role 조회에 실제 auth_id 가 필요하므로 hint 를 우회합니다.
  //  - /login 경로는 만료 상태 감지/hint 무효화 진입점으로 강제 getUser 호출
  //    (server-side requireAppUser 가 RSC 제약으로 hint 를 못 지우는 갭 보완).
  let user: unknown = null;
  let realAuthId: string | null = null;
  const useHintBypass =
    !isAdminPath &&
    !isLoginPath &&
    !isProtectedPath &&
    hint &&
    hasAuthCookie;
  if (useHintBypass) {
    user = { hinted: true };
  } else {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
    realAuthId = u?.id ?? null;
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

  // 어드민 전용 경로 차단 — users.role = 'admin' 만 통과
  if (isAdminPath) {
    if (!realAuthId) {
      const redirectResponse = NextResponse.redirect(
        new URL("/login", request.url)
      );
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
    const { data: row } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", realAuthId)
      .maybeSingle();
    if (!row || row.role !== "admin") {
      const redirectResponse = NextResponse.redirect(
        new URL("/", request.url)
      );
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
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

  if (!user && isProtectedPath) {
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
