import type { BrowserContext } from "playwright";

/** 번들 Chromium과 어긋나지 않게 맞춘 데스크톱 크롬 UA (맥) */
export const PLAYWRIGHT_DESKTOP_CHROME_UA_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 번들 Chromium과 어긋나지 않게 맞춘 데스크톱 크롬 UA (윈도우) */
export const PLAYWRIGHT_DESKTOP_CHROME_UA_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * `PLAYWRIGHT_UA_PROFILE`: `mac`(기본) | `windows` | `win`
 * 명시 문자열이 있으면 그대로 UA로 사용합니다.
 */
export function resolveDesktopChromeUserAgent(explicit?: string | null): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;

  const profile = process.env.PLAYWRIGHT_UA_PROFILE?.trim().toLowerCase();
  if (profile === "windows" || profile === "win") {
    return PLAYWRIGHT_DESKTOP_CHROME_UA_WINDOWS;
  }
  return PLAYWRIGHT_DESKTOP_CHROME_UA_MAC;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

/**
 * 연속 요청(내비게이션 등) 사이 사람처럼 불규칙한 대기(ms).
 * `PLAYWRIGHT_REQUEST_DELAY_MS_MIN` / `PLAYWRIGHT_REQUEST_DELAY_MS_MAX` 로 범위 조정(기본 3000~7000).
 */
export function randomPlaywrightHumanGapMs(): number {
  const defMin = 3000;
  const defMax = 7000;
  const rawMin = Number(process.env.PLAYWRIGHT_REQUEST_DELAY_MS_MIN ?? defMin);
  const rawMax = Number(process.env.PLAYWRIGHT_REQUEST_DELAY_MS_MAX ?? defMax);
  const min = Number.isFinite(rawMin) ? clampInt(rawMin, 0, 120_000) : defMin;
  let max = Number.isFinite(rawMax) ? clampInt(rawMax, 0, 120_000) : defMax;
  if (max < min) max = min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * `navigator.webdriver`를 일반 브라우저에 가깝게 보이도록 완화합니다.
 * (탐지 회피 보조이며, 서버·WAF 정책을 바꾸지는 않습니다.)
 */
export async function applyPlaywrightStealth(
  context: BrowserContext
): Promise<void> {
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
        configurable: true,
      });
    } catch {
      /* ignore */
    }
  });
}
