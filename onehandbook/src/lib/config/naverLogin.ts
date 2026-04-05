function truthyEnv(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const t = String(raw).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

function falsyEnv(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const t = String(raw).trim().toLowerCase();
  return t === "false" || t === "0" || t === "no" || t === "off";
}

function hasNaverClientId(): boolean {
  const id = process.env.NAVER_CLIENT_ID;
  return typeof id === "string" && id.trim() !== "";
}

/**
 * 네이버 로그인 버튼 노출.
 * - `NAVER_LOGIN_ENABLED`가 비어 있지 않으면 그 값만 따름(명시 false면 숨김).
 * - 아니면 `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=true`.
 * - 둘 다 없으면 `NAVER_CLIENT_ID`가 있으면 노출(Vercel에 공개 플래그 깜빡할 때 대비).
 */
export function resolveNaverLoginEnabledForServer(): boolean {
  const serverOnly = process.env.NAVER_LOGIN_ENABLED;
  if (serverOnly != null && String(serverOnly).trim() !== "") {
    if (falsyEnv(serverOnly)) return false;
    return truthyEnv(serverOnly);
  }
  if (truthyEnv(process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED)) return true;
  return hasNaverClientId();
}

/** 클라이언트 전용 코드에서 쓸 때(빌드 시 인라인됨) */
export function isNaverLoginEnabled(): boolean {
  return truthyEnv(process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED);
}

