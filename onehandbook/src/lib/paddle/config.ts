/**
 * ADR-0010 (Phase 3a): Paddle Sandbox 결제 시스템
 *
 * 목적
 * - 환경변수 검증 + 상수 export
 * - 클라이언트/서버 환경 분리
 * - 런타임 안전성 확보 (누락 시 즉시 명확히 fail)
 */

export const PADDLE_ENVIRONMENTS = ["sandbox", "production"] as const;
export type PaddleEnvironment = (typeof PADDLE_ENVIRONMENTS)[number];

function isServer(): boolean {
  return typeof window === "undefined";
}

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`[paddle] 환경변수 누락: ${name}`);
  }
  return v;
}

function readPaddleEnvironment(): PaddleEnvironment {
  const raw =
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT?.trim().toLowerCase() ?? "sandbox";

  if ((PADDLE_ENVIRONMENTS as readonly string[]).includes(raw)) {
    return raw as PaddleEnvironment;
  }

  throw new Error(
    `[paddle] NEXT_PUBLIC_PADDLE_ENVIRONMENT 값이 올바르지 않습니다. ` +
      `허용: ${PADDLE_ENVIRONMENTS.join(" | ")}, 현재: ${raw}`
  );
}

export const PADDLE_PRICES = {
  STANDARD_MONTHLY: requiredEnv("NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY"),
} as const;

export const PADDLE_CLIENT_CONFIG = {
  environment: readPaddleEnvironment(),
  clientToken: requiredEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"),
} as const;

/**
 * 서버 전용 설정 접근 함수
 * - 브라우저 번들에서 호출되면 즉시 에러 (시크릿 유출 방지)
 * - environment(sandbox/production)에 따라 API Key / Webhook Secret 분기
 */
export function getPaddleServerConfig(): {
  environment: PaddleEnvironment;
  apiKey: string;
  webhookSecret: string;
} {
  if (!isServer()) {
    throw new Error(
      "[paddle] getPaddleServerConfig()는 서버에서만 호출할 수 있습니다."
    );
  }

  const environment = readPaddleEnvironment();

  const apiKey =
    environment === "production"
      ? requiredEnv("PADDLE_API_KEY_PRODUCTION")
      : requiredEnv("PADDLE_API_KEY_SANDBOX");

  const webhookSecret =
    environment === "production"
      ? requiredEnv("PADDLE_WEBHOOK_SECRET_PRODUCTION")
      : requiredEnv("PADDLE_WEBHOOK_SECRET_SANDBOX");

  return { environment, apiKey, webhookSecret };
}

