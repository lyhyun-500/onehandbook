function falsyEnv(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const t = String(raw).trim().toLowerCase();
  return t === "false" || t === "0" || t === "no" || t === "off";
}

function envProvided(raw: string | undefined | null): boolean {
  return raw != null && String(raw).trim() !== "";
}

/**
 * 로그인 화면 네이버 버튼 노출.
 *
 * **기본값: 노출.** Vercel에 `NAVER_CLIENT_ID`만 넣고 공개 플래그를 빼먹어도 버튼이 보이게 함.
 * 숨기려면 아래 중 하나를 **명시적으로 false** 로 두면 됨:
 * - `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=false`
 * - `NAVER_LOGIN_ENABLED=false` (또는 0, no, off)
 *
 * 예전에 `NAVER_LOGIN_ENABLED`에 true/false가 아닌 값을 넣으면 “끔”으로 처리되던 버그도 제거함.
 */
export function resolveNaverLoginEnabledForServer(): boolean {
  const pub = process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED;
  if (envProvided(pub) && falsyEnv(pub)) {
    return false;
  }

  const serverOnly = process.env.NAVER_LOGIN_ENABLED;
  if (envProvided(serverOnly) && falsyEnv(serverOnly)) {
    return false;
  }

  return true;
}

/** 클라이언트 번들에서 쓸 때 — 서버와 동일 규칙(명시 false만 숨김) */
export function isNaverLoginEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED;
  if (envProvided(pub) && falsyEnv(pub)) {
    return false;
  }
  return true;
}
