import { headers } from "next/headers";

/**
 * Google 등 OAuth 완료 후 돌아올 앱의 origin (`redirectTo` = `{이 값}/auth/callback`).
 *
 * Supabase는 `redirectTo`가 **Authentication → URL Configuration → Redirect URLs**에
 * 없으면 **Site URL**(로컬로 두면 `http://localhost:3000`)로 보내는 경우가 많습니다.
 * 프로덕션에서는 `NEXT_PUBLIC_SITE_URL=https://novelagent.kr` 로 고정하는 것을 권장합니다.
 */
export async function getOAuthCallbackOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const hostHeader =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "";

  if (!hostHeader) {
    if (process.env.NODE_ENV === "production") {
      return "https://novelagent.kr";
    }
    return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  }

  let proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";
  if (proto !== "http" && proto !== "https") {
    proto =
      hostHeader.startsWith("localhost") || hostHeader.startsWith("127.")
        ? "http"
        : "https";
  }

  return `${proto}://${hostHeader}`;
}
