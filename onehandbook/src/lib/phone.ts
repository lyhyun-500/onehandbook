/** 한국 휴대폰 → 01xxxxxxxxx (11자리, 숫자만) */
export function normalizeKrPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("01")) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("821")) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 13 && digits.startsWith("8210")) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return `0${digits}`;
  }
  return null;
}
