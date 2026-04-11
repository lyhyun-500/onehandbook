import { headers } from "next/headers";

/**
 * API Route 등 `Request`만 있을 때. 로컬이 아니면 `NEXT_PUBLIC_SITE_URL`을 우선해
 * 라이브에서 www / 비-www · 프록시 호스트가 섞여 redirect_uri·쿠키 도메인이 어긋나는 것을 줄인다.
 */
export function getOAuthOriginFromRequest(request: Request): string {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]";
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv && !isLocal) return fromEnv;
  return url.origin;
}

/**
 * 서버에서 OAuth `redirectTo` 베이스 URL을 만들 때만 사용한다.
 * Google 로그인 버튼은 클라이언트에서 `window.location.origin`을 쓴다
 * (`src/app/login/LoginPageClient.tsx`).
 *
 * Google 등 OAuth 완료 후 돌아올 앱의 origin (`redirectTo` = `{이 값}/auth/callback`).
 *
 * **로컬 분기:** 브라우저가 `localhost` / `127.0.0.1`(등)으로 접속한 경우,
 * `NEXT_PUBLIC_SITE_URL`이 `https://novelagent.kr`로 잡혀 있어도 **무시**하고
 * 현재 요청의 Host로 콜백합니다. (로컬에서 구글 로그인 후 프로덕션으로 튀는 현상 방지)
 *
 * 프로덕션(Vercel 등)에서는 `NEXT_PUBLIC_SITE_URL`을 쓰는 편이 안전합니다.
 * Supabase Redirect URLs에 로컬·프로덕션 콜백을 모두 등록해 두세요.
 */
function isLocalDevHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (h === "localhost" || h.startsWith("localhost:")) return true;
  if (h.startsWith("127.0.0.1") && (h.length === 9 || h[9] === ":")) return true;
  if (h.startsWith("[::1]")) return true;
  return false;
}

export async function getOAuthCallbackOrigin(): Promise<string> {
  const h = await headers();
  const hostHeader =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "";

  let proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";
  if (proto !== "http" && proto !== "https") {
    proto =
      hostHeader.startsWith("localhost") || hostHeader.startsWith("127.")
        ? "http"
        : "https";
  }

  if (hostHeader && isLocalDevHost(hostHeader)) {
    return `${proto}://${hostHeader}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (!hostHeader) {
    if (process.env.NODE_ENV === "production") {
      return "https://novelagent.kr";
    }
    return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  }

  return `${proto}://${hostHeader}`;
}
