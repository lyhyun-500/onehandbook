/**
 * 브라우저에서 Google OAuth `redirectTo` 베이스로 쓸 origin.
 *
 * 로컬에서 주소창이 `http://127.0.0.1:3003`처럼 루프백이면, Supabase에는 **같은 포트의**
 * `http://localhost:3003/**` 가 등록돼 있어야 한다(3000만 등록·실제는 3003이면 프로덕션으로 튐).
 * `redirect_to`가 거부되고 **Site URL(프로덕션)** 으로 돌아가는 현상이 납니다.
 * 개발 모드에서는 같은 머신의 `localhost`로 통일해 흔한 허용 목록과 맞춥니다.
 */
export function getOAuthRedirectBaseForBrowser(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  const isDev = process.env.NODE_ENV === "development";
  const loopback =
    hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  if (isDev && loopback) {
    const p = port ? `:${port}` : "";
    return `${protocol}//localhost${p}`.replace(/\/$/, "");
  }
  return window.location.origin.replace(/\/$/, "");
}
