function truthyEnv(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const t = String(raw).trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

/**
 * 네이버 로그인 버튼 노출.
 * - `NAVER_LOGIN_ENABLED`가 비어 있지 않으면 이 값만 사용(서버 전용, 런타임 `.env` 반영에 유리).
 * - 그 외에는 `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=true`(대소문자·앞뒤 공백 허용).
 */
export function resolveNaverLoginEnabledForServer(): boolean {
  const serverOnly = process.env.NAVER_LOGIN_ENABLED;
  if (serverOnly != null && String(serverOnly).trim() !== "") {
    return truthyEnv(serverOnly);
  }
  return truthyEnv(process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED);
}

/** 클라이언트 전용 코드에서 쓸 때(빌드 시 인라인됨) */
export function isNaverLoginEnabled(): boolean {
  return truthyEnv(process.env.NEXT_PUBLIC_NAVER_LOGIN_ENABLED);
}

