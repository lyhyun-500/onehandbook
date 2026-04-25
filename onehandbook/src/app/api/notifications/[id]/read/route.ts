import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(s);
}

/**
 * 단일 알림 읽음 처리.
 *   - RLS 가 SELECT 만 허용하므로 UPDATE 는 service_role.
 *   - 본인 알림인지 user_id 매칭 한 번 더 검증 후 UPDATE.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json(
      { error: "사용자 정보를 찾을 수 없습니다." },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "잘못된 알림 id 입니다." }, { status: 400 });
  }

  const service = createSupabaseServiceRole();
  const { error } = await service
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", appUser.id)
    .is("read_at", null);

  if (error) {
    console.error("notification read:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
