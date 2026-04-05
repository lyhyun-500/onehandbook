import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";

const CONFIRM_PHRASE = "탈퇴합니다";

export async function POST(request: Request) {
  let body: { confirmPhrase?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.confirmPhrase?.trim() !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: "확인 문구가 일치하지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { error: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." },
      { status: 500 }
    );
  }

  const { data: row, error: rowErr } = await admin
    .from("users")
    .select("id, deleted_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json(
      { error: "회원 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  if (row.deleted_at) {
    return NextResponse.json(
      { error: "이미 탈퇴 처리된 계정입니다." },
      { status: 400 }
    );
  }

  const appUserId = row.id as number;

  const { data: worksRows } = await admin
    .from("works")
    .select("id")
    .eq("author_id", appUserId);

  const workIds = worksRows?.map((w: { id: number }) => w.id) ?? [];
  if (workIds.length > 0) {
    const { error: raErr } = await admin
      .from("reader_actions")
      .delete()
      .in("work_id", workIds);
    if (raErr) {
      console.error("withdraw reader_actions:", raErr.message);
    }
  }

  const { error: worksDelErr } = await admin
    .from("works")
    .delete()
    .eq("author_id", appUserId);

  if (worksDelErr) {
    console.error("withdraw works:", worksDelErr.message);
    return NextResponse.json(
      { error: "작품·분석 데이터 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  await admin.from("sms_otp_challenges").delete().eq("user_id", appUserId);
  await admin.from("payments").delete().eq("user_id", appUserId);
  await admin.from("nat_ledger").delete().eq("user_id", appUserId);
  await admin.from("analysis_jobs").delete().eq("app_user_id", appUserId);

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(user.id);
  if (delAuthErr) {
    console.error("withdraw deleteUser:", delAuthErr.message);
    return NextResponse.json(
      { error: "인증 계정 삭제에 실패했습니다. 잠시 후 다시 시도하거나 문의해 주세요." },
      { status: 500 }
    );
  }

  const withdrawnEmail = `withdrawn_${appUserId}_${Date.now()}@novelagent.withdrawn`;

  const { error: updErr } = await admin
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      auth_id: null,
      email: withdrawnEmail,
      nickname: "탈퇴한 사용자",
      phone_e164: null,
      phone_verified_at: null,
      phone_verification_bonus_granted_at: null,
    })
    .eq("id", appUserId);

  if (updErr) {
    console.error("withdraw users update:", updErr.message);
    return NextResponse.json(
      {
        error:
          "탈퇴 기록 저장에 실패했습니다. 로그인은 해제되었을 수 있으니 고객센터로 문의해 주세요.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
