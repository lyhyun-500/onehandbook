import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  adjustAuthCookiesForPersistence,
  isPersistentAuthFromCookieValue,
  OHB_AUTH_PERSISTENT_COOKIE,
} from "@/lib/supabase/authPersistence";

/**
 * 서버용 Supabase 클라이언트. persistSession·autoRefreshToken 은 true(브라우저 클라이언트와 맞춤).
 * 인증 쿠키 수명은 `ohb_auth_persistent` 와 동일 규칙으로 조정합니다.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const persistent = isPersistentAuthFromCookieValue(
    cookieStore.get(OHB_AUTH_PERSISTENT_COOKIE)?.value
  );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const adjusted = adjustAuthCookiesForPersistence(
              cookiesToSet,
              persistent
            );
            adjusted.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options ?? {})
            );
          } catch {
            // Server Component에서 호출 시 무시
          }
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}
