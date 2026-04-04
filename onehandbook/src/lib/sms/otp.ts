import { createHash, randomInt } from "crypto";

const OTP_LEN = 6;
const MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LEN)).padStart(OTP_LEN, "0");
}

export function hashOtpCode(
  secret: string,
  userId: number,
  phoneE164: string,
  code: string
): string {
  return createHash("sha256")
    .update(`${secret}:${userId}:${phoneE164}:${code}`)
    .digest("hex");
}

export { OTP_LEN, MAX_ATTEMPTS };
