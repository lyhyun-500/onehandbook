import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null | undefined;
let warnedMissingUpstash = false;

function isProductionDeploy(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function getRatelimit(): Ratelimit | null {
  if (ratelimit !== undefined) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (isProductionDeploy() && !warnedMissingUpstash) {
      warnedMissingUpstash = true;
      console.error(
        "[analyzeRateLimit] 프로덕션에서 Upstash 미설정 — 분당 3회 제한이 비활성화됩니다. Vercel에 UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN 을 설정하세요."
      );
    }
    ratelimit = null;
    return null;
  }
  const redis = new Redis({ url, token });
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    prefix: "ratelimit:analyze",
  });
  return ratelimit;
}

/** 유저당 분당 3회. Upstash 미설정 시 제한 없음(개발·미구성 프로덕션). */
export async function checkAnalyzeRateLimit(
  userId: string
): Promise<{ success: true } | { success: false }> {
  const rl = getRatelimit();
  if (!rl) {
    return { success: true };
  }
  const { success } = await rl.limit(`user:${userId}`);
  return success ? { success: true } : { success: false };
}
