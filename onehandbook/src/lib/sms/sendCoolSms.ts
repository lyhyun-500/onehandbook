import { SolapiMessageService } from "solapi";

export async function sendVerificationSms(
  toPhoneDigits: string,
  code: string
): Promise<void> {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const from = process.env.COOLSMS_FROM;

  if (!apiKey || !apiSecret || !from) {
    throw new Error("CoolSMS 환경변수(COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_FROM)가 설정되지 않았습니다.");
  }

  if (process.env.COOLSMS_MOCK === "1") {
    console.info("[COOLSMS_MOCK] SMS 미발송. to=%s code=%s", toPhoneDigits, code);
    return;
  }

  const messageService = new SolapiMessageService(apiKey, apiSecret);
  await messageService.sendOne({
    to: toPhoneDigits.replace(/\D/g, ""),
    from: from.replace(/\D/g, ""),
    text: `[Novel Agent] 인증번호는 [${code}] 입니다. 10분 이내에 입력해 주세요.`,
    type: "SMS",
  });
}
