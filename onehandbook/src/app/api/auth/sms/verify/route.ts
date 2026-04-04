import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { normalizeKrPhone } from "@/lib/phone";
import { hashOtpCode, MAX_ATTEMPTS } from "@/lib/sms/otp";
import { NextResponse } from "next/server";

const BONUS_NAT = 30;

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
    .select("nat_balance, phone_verification_bonus_granted_at")
    .eq("id", appUser.id)
    .single();

  const grantBonus = !meRow?.phone_verification_bonus_granted_at;
  const baseNat = meRow?.nat_balance ?? 0;
  const nextBalance = baseNat + (grantBonus ? BONUS_NAT : 0);

  const { error: updErr } = await supabase
    .from("users")
    .update({
      phone_e164: normalized,
      phone_verified_at: nowIso,
      ...(grantBonus
        ? {
            nat_balance: nextBalance,
            phone_verification_bonus_granted_at: nowIso,
          }
        : {}),
    })
    .eq("id", appUser.id)
    .is("phone_verified_at", null);

  if (updErr) {
    if (updErr.code === "23505") {
      return NextResponse.json(
        { error: "이 번호는 이미 다른 계정에서 인증되었습니다." },
        { status: 409 }
      );
    }
    console.error(updErr);
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
    natGranted: grantBonus ? BONUS_NAT : 0,
    natBalance: nextBalance,
  });
}
