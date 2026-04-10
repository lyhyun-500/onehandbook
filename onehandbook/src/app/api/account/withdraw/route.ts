import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";

const WITHDRAW_REASONS = [
  "비용이 부담돼요",
  "원하는 기능이 없어요",
  "분석 품질이 기대에 못 미쳐요",
  "더 좋은 서비스를 찾았어요",
  "당분간 쓸 일이 없어요",
  "기타",
] as const;
type WithdrawReason = (typeof WITHDRAW_REASONS)[number];

function resolveFallbackEmailFromAuthUser(user: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const rawNaverEmail = user.user_metadata?.naver_email;
  if (typeof rawNaverEmail === "string") {
    const t = rawNaverEmail.trim();
    if (t && t.includes("@")) return t;
  }
  if (user.email) return user.email;
  const prov = String(user.app_metadata?.provider ?? "oauth");
  const suffix = user.id.replace(/-/g, "").slice(0, 24);
  return `${prov}_${suffix}@oauth.novelagent.local`;
}

export async function POST(request: Request) {
  let body: {
    reason?: string;
    reasonDetail?: string;
    confirmed?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonDetail =
    typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : "";
  const confirmed = body.confirmed === true;

  if (!confirmed) {
    return NextResponse.json(
      { error: "탈퇴 동의가 필요합니다." },
      { status: 400 }
    );
  }
  if (!reason || !(WITHDRAW_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json(
      { error: "탈퇴 이유를 선택해 주세요." },
      { status: 400 }
    );
  }
  if (reason === "기타" && reasonDetail.length < 2) {
    return NextResponse.json(
      { error: "기타 사유를 입력해 주세요." },
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

  // 간헐적으로 OAuth 직후 public.users 동기화가 누락되면
  // 탈퇴 시 "회원 정보를 찾을 수 없습니다"가 발생할 수 있어 사전에 보정합니다.
  try {
    await syncAppUser(supabase);
  } catch (e) {
    console.warn("withdraw syncAppUser failed (ignored):", e);
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

  let { data: row, error: rowErr } = await admin
    .from("users")
    .select("id, deleted_at, phone_e164")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!rowErr && !row) {
    // public.users가 아직 없으면(예: RLS로 syncAppUser 실패) server-side로 강제 생성합니다.
    const email = resolveFallbackEmailFromAuthUser(user);
    const nickname = email.split("@")[0]?.slice(0, 50) || "user";
    const up = await admin
      .from("users")
      .upsert(
        { auth_id: user.id, email, nickname },
        { onConflict: "auth_id" }
      )
      .select("id, deleted_at, phone_e164")
      .single();
    row = up.data ?? null;
    rowErr = up.error ?? null;
  }

  if (rowErr || !row) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    console.error("withdraw users lookup/upsert failed:", {
      message: rowErr?.message,
      code: (rowErr as unknown as { code?: string })?.code,
      auth_id: user.id,
      supabaseUrl: url,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "회원 정보를 찾을 수 없습니다.",
        ...(isProd
          ? {}
          : {
              debug: {
                message: rowErr?.message ?? null,
                code: (rowErr as unknown as { code?: string })?.code ?? null,
                supabaseUrl: url || null,
              },
            }),
      },
      { status: 500 }
    );
  }
  if (row.deleted_at) {
    return NextResponse.json(
      { error: "이미 탈퇴 처리된 계정입니다." },
      { status: 400 }
    );
  }

  const appUserId = row.id as number;
  const phoneAtWithdraw =
    typeof row.phone_e164 === "string" ? row.phone_e164.trim() || null : null;

  // 0) 탈퇴 사유 기록(요구사항: 탈퇴 완료 시 INSERT 후 계정 삭제)
  const { error: insErr } = await admin.from("account_withdrawals").insert({
    user_id: appUserId,
    reason: reason as WithdrawReason,
    reason_detail: reason === "기타" ? reasonDetail : null,
  });
  if (insErr) {
    console.error("withdraw account_withdrawals insert:", insErr.message);
    return NextResponse.json(
      { error: "탈퇴 사유 저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  if (phoneAtWithdraw) {
    const { error: blErr } = await admin.from("blacklisted_phones").upsert(
      { phone_e164: phoneAtWithdraw, reason: "user_withdrawal" },
      { onConflict: "phone_e164" }
    );
    if (blErr) {
      console.error("blacklisted_phones upsert:", blErr.message);
    }
  }

  const { error: profDelErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", appUserId);
  if (profDelErr && profDelErr.code !== "42P01") {
    console.warn("withdraw profiles delete:", profDelErr.message);
  }

  const { data: expireData, error: expireErr } = await admin.rpc(
    "expire_coins_on_user_withdrawal",
    { p_user_id: appUserId }
  );
  const expireJson = expireData as { ok?: boolean; error?: string } | null;
  if (expireErr || !expireJson || expireJson.ok !== true) {
    console.error("expire_coins_on_user_withdrawal:", expireErr ?? expireJson);
    return NextResponse.json(
      { error: "코인 잔액 정리에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

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
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "작품·분석 데이터 삭제 중 오류가 발생했습니다.",
        ...(isProd
          ? {}
          : {
              debug: {
                message: worksDelErr.message,
                code: (worksDelErr as unknown as { code?: string })?.code ?? null,
                details:
                  (worksDelErr as unknown as { details?: string })?.details ?? null,
              },
            }),
      },
      { status: 500 }
    );
  }

  await admin.from("sms_otp_challenges").delete().eq("user_id", appUserId);
  await admin.from("payments").delete().eq("user_id", appUserId);
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
