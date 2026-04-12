/**
 * Supabase OAuth(네이버 등)가 user.email에 넣는 로컬/플레이스홀더 주소.
 * 실제 인터넷 메일로는 도달하지 않으므로 Reply-To 로 쓰면 안 된다.
 */
export function isLikelyNonRoutableAuthEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@")) return true;
  if (e.endsWith(".local")) return true;
  if (e.includes("oauth.local")) return true;
  return false;
}

const LOOSE_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** 회신용으로 쓸 수 있는 형식이면서 플레이스홀더가 아닌지 */
export function isValidReplyRecipientEmail(email: string): boolean {
  const t = email.trim();
  if (!t || isLikelyNonRoutableAuthEmail(t)) return false;
  return LOOSE_EMAIL.test(t);
}
