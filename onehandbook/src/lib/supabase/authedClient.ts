import { createClient } from "@supabase/supabase-js";

/** 서버 간 호출 시 사용자 JWT로 RLS·consume_nat(auth.uid())가 동작하도록 클라이언트 생성 */
export function createSupabaseWithAccessToken(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase URL/anon key가 설정되지 않았습니다.");
  }
  return createClient(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
