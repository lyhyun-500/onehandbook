/**
 * 디자인 개편 Feature Flag — 순수 평가 함수 + types.
 *
 * 우선순위: query > cookie > env > false
 *
 * NEXT_PUBLIC_* env 접근은 반드시 literal access (TS-002 교훈).
 * dynamic key access (`process.env[name]`) 는 webpack DefinePlugin 이 inline 못 하므로
 * client bundle 에서 undefined 가 되어버린다. 절대 금지.
 *
 * server/client wrapper:
 * - `feature-flags-server.ts` : RSC/Server Action/Route Handler
 * - `feature-flags-client.ts` : Client Component
 */

export type RedesignFlag =
  | "landing"
  | "studio"
  | "work-detail"
  | "work-analysis"
  | "pricing"
  | "billing"
  | "account";

export const REDESIGN_FLAGS: readonly RedesignFlag[] = [
  "landing",
  "studio",
  "work-detail",
  "work-analysis",
  "pricing",
  "billing",
  "account",
] as const;

export type FlagSource = "query" | "cookie" | "env" | "off";

/** 쿠키 이름 — server/client 양쪽에서 공용. */
export const NEWUI_COOKIE_NAME = "newui_flags";

/** 쿠키 만료 (일 단위). /dev/flags 토글 UI 에서 사용. */
export const NEWUI_COOKIE_MAX_AGE_DAYS = 30;

/**
 * NEXT_PUBLIC_* 변수는 **literal access 만** webpack DefinePlugin 이 inline 한다.
 * 모든 flag 변수를 record 에 literal 로 박아둔다. dynamic 접근 절대 금지.
 */
const ENV_FLAGS: Record<RedesignFlag, string | undefined> = {
  landing: process.env.NEXT_PUBLIC_REDESIGN_LANDING,
  studio: process.env.NEXT_PUBLIC_REDESIGN_STUDIO,
  "work-detail": process.env.NEXT_PUBLIC_REDESIGN_WORK_DETAIL,
  "work-analysis": process.env.NEXT_PUBLIC_REDESIGN_WORK_ANALYSIS,
  pricing: process.env.NEXT_PUBLIC_REDESIGN_PRICING,
  billing: process.env.NEXT_PUBLIC_REDESIGN_BILLING,
  account: process.env.NEXT_PUBLIC_REDESIGN_ACCOUNT,
};

export interface FlagContext {
  /** 쿼리스트링 ?newui=<flag> | newui=all | newui=off */
  newuiQuery?: string | null;
  /** 쿠키 newui_flags=<flag>,<flag2>... (콤마 구분, "all" 도 가능) */
  newuiCookie?: string | null;
}

export interface FlagEvaluation {
  enabled: boolean;
  source: FlagSource;
}

/**
 * Flag 평가 — 우선순위 query > cookie > env > false.
 * source 필드로 어디서 결정됐는지 확인 가능 (디버깅 / /dev/flags 표시).
 */
export function evaluateRedesignFlag(
  flag: RedesignFlag,
  ctx: FlagContext
): FlagEvaluation {
  // 1. 쿼리스트링 (?newui=...)
  const q = ctx.newuiQuery?.trim();
  if (q === "off") return { enabled: false, source: "query" };
  if (q === "all" || q === flag) return { enabled: true, source: "query" };

  // 2. 쿠키 (newui_flags=...)
  const cookieValue = ctx.newuiCookie?.trim();
  if (cookieValue) {
    const flags = cookieValue.split(",").map((s) => s.trim()).filter(Boolean);
    if (flags.includes("all") || flags.includes(flag)) {
      return { enabled: true, source: "cookie" };
    }
  }

  // 3. 환경변수 (NEXT_PUBLIC_REDESIGN_*=true)
  if (ENV_FLAGS[flag] === "true") {
    return { enabled: true, source: "env" };
  }

  return { enabled: false, source: "off" };
}

/** 단순 boolean 이 필요할 때. */
export function isRedesignEnabled(
  flag: RedesignFlag,
  ctx: FlagContext
): boolean {
  return evaluateRedesignFlag(flag, ctx).enabled;
}
