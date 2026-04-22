import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminContext = {
  /** users.id (bigint → number) — RPC/쿼리 호환 */
  userId: number;
  /** auth.users.id (UUID) — coin_logs.metadata.adjusted_by 등에 기록 */
  authId: string;
  email: string;
  role: "admin";
};

/**
 * 어드민 전용 서버 컴포넌트/라우트 핸들러 진입점에서 호출.
 *   - Middleware 가 /admin/** 경로에서 1차 차단하지만, 직접 호출되는 API 라우트
 *     (/api/admin/**) 등에서도 이 헬퍼로 한 번 더 검증한다.
 *   - 기존 `requireAppUser` 패턴을 따라 실패 시 redirect 로 종료.
 *   - `supabase` 는 요청 컨텍스트의 서버 클라이언트 (auth 쿠키 포함) 를 넘길 것.
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<AdminContext> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: row, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (error || !row || row.role !== "admin") {
    redirect("/");
  }

  return {
    userId: row.id as number,
    authId: authUser.id,
    email: (row.email as string | null) ?? authUser.email ?? "",
    role: "admin",
  };
}
