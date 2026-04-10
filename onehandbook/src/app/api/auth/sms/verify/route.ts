import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";
import { normalizeKrPhone } from "@/lib/phone";
import { hashOtpCode, MAX_ATTEMPTS } from "@/lib/sms/otp";
import { NextResponse } from "next/server";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";

export async function POST(request: Request) {
  const secret = process.env.SMS_OTP_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "서버 인증 설정이 완료되지 않았습니다." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  if (appUser.phone_verified) {
    return NextResponse.json(
      { error: "이미 휴대폰 인증이 완료된 계정입니다." },
      { status: 400 }
    );
  }

  let body: { phone?: string; code?: string };
  try {
    body = (await request.json()) as { phone?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const normalized = normalizeKrPhone(body.phone ?? "");
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!normalized || code.length !== 6) {
    return NextResponse.json(
      { error: "휴대폰 번호와 6자리 인증번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  const { data: taken } = await supabase
    .from("users")
    .select("id")
    .eq("phone_e164", normalized)
    .not("phone_verified_at", "is", null)
    .neq("id", appUser.id)
    .maybeSingle();

  if (taken) {
    return NextResponse.json(
      { error: "이 번호는 이미 다른 계정에서 인증되었습니다." },
      { status: 409 }
    );
  }

  const { data: row, error: findErr } = await supabase
    .from("sms_otp_challenges")
    .select("id, code_hash, expires_at, consumed_at, attempts")
    .eq("user_id", appUser.id)
    .eq("phone_e164", normalized)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr || !row) {
    return NextResponse.json(
      { error: "유효한 인증 요청이 없습니다. 인증번호를 다시 요청해 주세요." },
      { status: 400 }
    );
  }

  if (row.consumed_at) {
    return NextResponse.json(
      { error: "이미 사용된 인증입니다." },
      { status: 400 }
    );
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "인증번호가 만료되었습니다. 다시 요청해 주세요." },
      { status: 400 }
    );
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "시도 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요." },
      { status: 400 }
    );
  }

  const expectedHash = hashOtpCode(secret, appUser.id, normalized, code);
  if (expectedHash !== row.code_hash) {
    await supabase
      .from("sms_otp_challenges")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return NextResponse.json(
      { error: "인증번호가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();

  const { data: meRow } = await supabase
    .from("users")
    .select("is_rewarded")
    .eq("id", appUser.id)
    .single();

  const grantBonus = meRow?.is_rewarded !== true;

  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { error: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." },
      { status: 500 }
    );
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc(
    "apply_phone_verification_success",
    {
      p_user_id: appUser.id,
      p_phone_e164: normalized,
      p_grant_bonus: grantBonus,
      p_bonus_amount: grantBonus ? PHONE_SIGNUP_REWARD_COINS : 0,
    }
  );

  const rpc = rpcData as { ok?: boolean; error?: string; coin_balance?: number; granted?: number } | null;

  if (rpcErr || !rpc || rpc.ok !== true) {
    const code = rpc?.error ?? rpcErr?.message ?? "rpc_failed";
    if (code === "already_verified_or_missing") {
      return NextResponse.json(
        { error: "이미 휴대폰 인증이 완료된 계정입니다." },
        { status: 400 }
      );
    }
    if (code === "phone_blacklisted") {
      return NextResponse.json(
        { error: "탈퇴 이력이 있는 번호는 재가입·인증이 제한됩니다." },
        { status: 403 }
      );
    }
    if (code === "phone_already_registered") {
      return NextResponse.json(
        { error: "이 번호는 이미 다른 계정에서 인증되었습니다." },
        { status: 409 }
      );
    }
    if (code === "invalid_bonus") {
      return NextResponse.json(
        { error: "가입 보상 지급 조건을 만족하지 않습니다." },
        { status: 400 }
      );
    }
    console.error("apply_phone_verification_success:", rpcErr ?? rpc);
    return NextResponse.json(
      { error: "인증 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  await supabase
    .from("sms_otp_challenges")
    .update({ consumed_at: nowIso })
    .eq("id", row.id);

  return NextResponse.json({
    ok: true,
    natGranted: rpc.granted ?? 0,
    natBalance: rpc.coin_balance ?? 0,
  });
}
