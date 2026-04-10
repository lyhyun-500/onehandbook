import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";
import { normalizeKrPhone } from "@/lib/phone";
import {
  generateOtpCode,
  hashOtpCode,
  OTP_LEN,
} from "@/lib/sms/otp";
import { sendVerificationSms } from "@/lib/sms/sendCoolSms";
import { NextResponse } from "next/server";

const OTP_TTL_MIN = 10;
const MAX_SEND_PER_HOUR = 5;

export async function POST(request: Request) {
  const secret = process.env.SMS_OTP_SECRET;
  if (!secret || secret.length < 16) {
    console.error("SMS_OTP_SECRET 미설정 또는 너무 짧음");
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

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const normalized = normalizeKrPhone(body.phone ?? "");
  if (!normalized) {
    return NextResponse.json(
      { error: "올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)" },
      { status: 400 }
    );
  }

  let adminSend;
  try {
    adminSend = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { error: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." },
      { status: 500 }
    );
  }

  const { data: blocked } = await adminSend
    .from("blacklisted_phones")
    .select("phone_e164")
    .eq("phone_e164", normalized)
    .maybeSingle();

  if (blocked) {
    return NextResponse.json(
      { error: "탈퇴 이력이 있는 번호는 인증할 수 없습니다." },
      { status: 403 }
    );
  }

  const { data: profileTaken } = await adminSend
    .from("profiles")
    .select("id")
    .eq("phone_number", normalized)
    .neq("id", appUser.id)
    .maybeSingle();

  if (profileTaken) {
    return NextResponse.json(
      { error: "이 번호는 이미 다른 계정에서 인증되었습니다." },
      { status: 409 }
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

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await supabase
    .from("sms_otp_challenges")
    .select("*", { count: "exact", head: true })
    .eq("user_id", appUser.id)
    .gte("created_at", since);

  if (cntErr) {
    console.error(cntErr);
    return NextResponse.json(
      { error: "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  if ((count ?? 0) >= MAX_SEND_PER_HOUR) {
    return NextResponse.json(
      { error: "인증번호 요청 횟수가 너무 많습니다. 1시간 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(secret, appUser.id, normalized, code);
  const expiresAt = new Date(
    Date.now() + OTP_TTL_MIN * 60 * 1000
  ).toISOString();

  const { error: insErr } = await supabase.from("sms_otp_challenges").insert({
    user_id: appUser.id,
    phone_e164: normalized,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insErr) {
    console.error(insErr);
    if (insErr.code === "42P01" || insErr.message?.includes("sms_otp")) {
      return NextResponse.json(
        { error: "DB에 sms_otp_challenges 테이블이 없습니다. supabase-migration-phone-auth.sql 을 실행하세요." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "인증 정보 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  try {
    await sendVerificationSms(normalized, code);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "문자 발송에 실패했습니다. CoolSMS 설정을 확인해 주세요.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    expiresInMinutes: OTP_TTL_MIN,
    otpDigits: OTP_LEN,
  });
}
