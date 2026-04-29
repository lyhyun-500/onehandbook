/**
 * ADR-0010 Phase 3a Step 3-1 — Paddle Billing Webhook 서명 검증(HMAC-SHA256)
 *
 * Paddle 공식 문서(서명 검증):
 * https://developer.paddle.com/webhooks/signature-verification
 *
 * 목적
 * - `paddle-signature` 헤더를 파싱/검증해 **가짜 webhook** 으로 인한 상태 오염(예: NAT 무한 충전)을 차단합니다.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Paddle signature 헤더에서 `ts` / `h1` 값 추출에 성공했을 때의 형태 */
export type ParsedPaddleSignature = {
  /** Unix timestamp (초) */
  timestamp: number;
  /** HMAC 결과 (hex 문자열) */
  hash: string;
};

/**
 * `paddle-signature` 헤더 문자열을 파싱합니다.
 *
 * 예상 형식(문서 예시 패턴 기반): `ts=1234567890;h1=abc123...`
 * - 세미콜론으로 각 key=value 블록을 분리합니다.
 */
export function parsePaddleSignature(
  header: string | null
): ParsedPaddleSignature | null {
  if (!header) return null;

  let tsRaw: string | undefined;
  let h1Raw: string | undefined;

  for (const segment of header.split(";")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;

    const key = segment.slice(0, idx).trim();
    const value = segment.slice(idx + 1).trim();

    if (key === "ts") tsRaw = value;
    if (key === "h1") h1Raw = value;
  }

  if (!tsRaw || !h1Raw) return null;

  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp)) return null;

  return { timestamp, hash: h1Raw };
}

function normalizeHexDigestHex(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/i.test(s)) return null;

  /**
   * HMAC-SHA256은 hex 문자열 길이 64(바이너리 32)가 일반적.
   * 짝수 hex만 Buffer로 디코드 가능합니다.
   */
  if (s.length % 2 !== 0) return null;

  return s;
}

function hexDigestToBuf(hex: string): Buffer | null {
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Paddle Billing webhook 서명 검증.
 *
 * - secret 은 호출자가 주입해야 합니다(테스트 가능 + 환경 격리).
 * - 라우트 핸들러에서는 보통 `getPaddleServerConfig().webhookSecret` 을 전달합니다.
 */
export function verifyPaddleSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string } {
  const toleranceSeconds = params.toleranceSeconds ?? 300;

  if (!params.signatureHeader) {
    return { valid: false, reason: "missing_signature" };
  }

  const parsed = parsePaddleSignature(params.signatureHeader);
  if (!parsed) {
    return { valid: false, reason: "invalid_signature_format" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (parsed.timestamp > nowSeconds + toleranceSeconds) {
    return { valid: false, reason: "signature_in_future" };
  }

  if (nowSeconds - parsed.timestamp > toleranceSeconds) {
    return { valid: false, reason: "signature_too_old" };
  }

  const signedPayload = `${parsed.timestamp}:${params.rawBody}`;

  /**
   * `expected` 과 `provided` 두 digest 를 **동일 규격(hex buffer)** 으로 맞춘 뒤 비교해야
   * `timingSafeEqual` 을 안전하게 쓸 수 있습니다.
   */
  const expectedHex = createHmac("sha256", params.secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedDigestHex = normalizeHexDigestHex(expectedHex);
  const providedDigestHex = normalizeHexDigestHex(parsed.hash);

  if (!expectedDigestHex || !providedDigestHex) {
    return { valid: false, reason: "signature_mismatch" };
  }

  const expectedBuf = hexDigestToBuf(expectedDigestHex);
  const providedBuf = hexDigestToBuf(providedDigestHex);

  /**
   * SHA-256 출력은 고정 길이(256bit)지만, 헤더의 h1 형식 오염/절단 케이스를 방어적으로 처리합니다.
   */
  if (!expectedBuf || !providedBuf) {
    return { valid: false, reason: "signature_mismatch" };
  }

  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: "signature_mismatch" };
  }

  let equal = false;
  try {
    equal = timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    /**
     * `timingSafeEqual` 은 버퍼 길이가 같아야 하는데 위에서 이미 차단했으나,
     * 안전 장치 레벨로 방어 처리합니다.
     */
    return { valid: false, reason: "signature_mismatch" };
  }

  return equal ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
