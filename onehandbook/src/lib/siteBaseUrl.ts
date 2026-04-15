/**
 * 서버가 자기 자신에게 HTTP 호출할 때 사용하는 공개 URL.
 * Vercel: NEXT_PUBLIC_SITE_URL 권장. 미설정 시 프로덕션 기본 novelagent.kr.
 */
export function getInternalSiteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  // 프로덕션에서 NEXT_PUBLIC_SITE_URL 이 실수로 localhost로 잡히면
  // 서버가 자기 자신을 호출할 때 실패하므로 무시한다.
  const isLocalhost =
    typeof fromEnv === "string" &&
    (fromEnv.includes("127.0.0.1") || fromEnv.includes("localhost"));
  if (fromEnv && !(process.env.NODE_ENV === "production" && isLocalhost)) {
    return fromEnv;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://novelagent.kr";
  }

  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

/**
 * (레거시) `/api/analyze/process`를 수동으로 호출할 때 베이스 URL.
 * 단일 분석 트리거는 셀프 HTTP 없이 `executeAnalysisJob` 직접 호출을 쓴다.
 */
export function getAnalyzeProcessBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  }
  return getInternalSiteBaseUrl();
}
