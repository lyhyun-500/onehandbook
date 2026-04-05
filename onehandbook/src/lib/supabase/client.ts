import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import {
  adjustAuthCookiesForPersistence,
  readPersistentFromDocumentCookie,
} from "@/lib/supabase/authPersistence";

/**
 * 브라우저용 Supabase 클라이언트.
 * @supabase/ssr 기본값과 동일하게 persistSession·autoRefreshToken 은 true.
 * `ohb_auth_persistent` 쿠키(로그인 페이지에서 설정)에 따라 인증 쿠키를 장기/세션으로 나눕니다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          const parsed = parse(document.cookie);
          return Object.keys(parsed).map((name) => ({
            name,
            value: parsed[name] ?? "",
          }));
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          const persistent = readPersistentFromDocumentCookie();
          const adjusted = adjustAuthCookiesForPersistence(
            cookiesToSet,
            persistent
          );
          adjusted.forEach(({ name, value, options }) => {
            document.cookie = serialize(name, value, options ?? {});
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}
