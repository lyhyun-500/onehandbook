import { parse, serialize, type SerializeOptions } from "cookie";

/** 서버·클라이언트가 동일하게 참조 — 로그인 상태 유지(장기 쿠키) vs 세션 전용 쿠키 */
export const OHB_AUTH_PERSISTENT_COOKIE = "ohb_auth_persistent";

/** 다음 방문 시 체크박스 기본값 (로컬 전용) */
export const OHB_REMEMBER_ME_LS_KEY = "ohb_remember_me";

export function isSupabaseAuthCookieName(name: string): boolean {
  return /^sb-[^-]+-auth-token/.test(name);
}

export function isPersistentAuthFromCookieValue(
  value: string | undefined
): boolean {
  return value !== "0";
}

type CookieSetRow = {
  name: string;
  value: string;
  options?: SerializeOptions;
};

/**
 * @supabase/ssr 가 넣는 maxAge를 덮어쓸 수 없어, setAll 단계에서 조정합니다.
 * persistent === false 이면 인증 쿠키는 Max-Age 없이(브라우저 종료 시 소멸되는 세션 쿠키).
 */
export function adjustAuthCookiesForPersistence(
  cookiesToSet: CookieSetRow[],
  persistent: boolean
): CookieSetRow[] {
  return cookiesToSet.map(({ name, value, options }) => {
    if (!isSupabaseAuthCookieName(name)) {
      return { name, value, options };
    }

    const secure = process.env.NODE_ENV === "production";

    if (!value) {
      return {
        name,
        value: "",
        options: {
          path: "/",
          sameSite: "lax",
          secure,
          maxAge: 0,
        },
      };
    }

    if (persistent) {
      return { name, value, options };
    }

    return {
      name,
      value,
      options: {
        path: "/",
        sameSite: "lax",
        secure,
      },
    };
  });
}

/** 로그인 직후 브라우저에 선호 쿠키 설정 (미들웨어·커스텀 setAll이 참조) */
export function setClientPersistencePreferenceCookie(persistent: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = serialize(OHB_AUTH_PERSISTENT_COOKIE, persistent ? "1" : "0", {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: window.location.protocol === "https:",
  });
}

export function readPersistentFromDocumentCookie(): boolean {
  if (typeof document === "undefined") return true;
  const parsed = parse(document.cookie);
  return isPersistentAuthFromCookieValue(parsed[OHB_AUTH_PERSISTENT_COOKIE]);
}
