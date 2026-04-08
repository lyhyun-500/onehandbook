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

/**
 * 로컬 `npm run dev`에서 `NEXT_PUBLIC_SITE_URL`이 프로덕션(예: novelagent.kr)이면
 * `runAnalysisProcessAfterResponse`가 원격 `/api/analyze/process`를 때려 **로컬 DB의 잡을 못 찾는** 문제가 납니다.
 * 개발 모드에서는 항상 현재 머신의 dev 서버로 self-call 합니다.
 */
export function getAnalyzeProcessBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  }
  return getInternalSiteBaseUrl();
}
