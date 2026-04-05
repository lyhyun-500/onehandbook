import { createClient } from "@supabase/supabase-js";

/** 서버 전용 — 네이버 OAuth 등 관리자 작업. `SUPABASE_SERVICE_ROLE_KEY` 필수 */
export function createSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
