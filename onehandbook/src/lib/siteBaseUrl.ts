/**
 * 서버가 자기 자신에게 HTTP 호출할 때 사용하는 공개 URL.
 * Vercel: NEXT_PUBLIC_SITE_URL 권장. 미설정 시 프로덕션 기본 novelagent.kr.
 */
export function getInternalSiteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://novelagent.kr";
  }

  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}
