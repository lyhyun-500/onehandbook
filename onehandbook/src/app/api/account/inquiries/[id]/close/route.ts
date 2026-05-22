import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";

export const runtime = "nodejs";

/**
 * 사용자 본인 inquiry 의 closed_at 갱신 ("해결됨" 액션).
 *
 * 보호 (Phase 2-D-9 commit 1 migration 정합):
 *   - RLS "Users can close own inquiries" — owner row 만 UPDATE 허용
 *   - GRANT UPDATE (closed_at) ON public.inquiries TO authenticated — closed_at 컬럼만 갱신 가능
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  try {
    await requireAppUser(supabase);
  } catch {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("inquiries")
    .update({ closed_at: now })
    .eq("id", id)
    .select("id, closed_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "종료 처리에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, closed_at: data.closed_at });
}
