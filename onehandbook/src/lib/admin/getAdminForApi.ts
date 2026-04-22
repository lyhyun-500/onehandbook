import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminContext } from "./requireAdmin";

/**
 * API 라우트용 어드민 검증. 실패 시 `null` 반환.
 *   - 서버 컴포넌트용 `requireAdmin` 은 실패 시 redirect 하지만,
 *     API 라우트에서는 JSON 401 응답이 자연스러우므로 호출자가 제어하도록 분리.
 *   - `supabase` 는 요청 컨텍스트의 서버 클라이언트 (auth 쿠키 포함) 를 넘길 것.
 */
export async function getAdminForApi(
  supabase: SupabaseClient
): Promise<AdminContext | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: row, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (error || !row || row.role !== "admin") return null;

  return {
    userId: row.id as number,
    authId: authUser.id,
    email: (row.email as string | null) ?? authUser.email ?? "",
    role: "admin",
  };
}
