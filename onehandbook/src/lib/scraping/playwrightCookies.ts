import { readFile } from "fs/promises";
import type { Browser, BrowserContext } from "playwright";
import {
  applyPlaywrightStealth,
  resolveDesktopChromeUserAgent,
} from "@/lib/scraping/playwrightStealth";

/**
 * Cursor/브라우저에서 내보낸 `cookies.json`을 Playwright 컨텍스트에 반영합니다.
 *
 * 지원 형식:
 * 1) Playwright `storageState` JSON (`{ cookies, origins? }`) — 권장
 * 2) 쿠키 객체만 있는 배열 `[{ name, value, domain, path, ... }]`
 *
 * `storageState` 파일 경로를 그대로 쓰려면 `browser.newContext({ storageState: path })` 도 가능하지만,
 * 여기서는 파싱해 객체로 넘겨 동일 동작을 보장합니다.
 */
export type NewContextWithCookiesOptions = {
  /** 미지정 시 맥/윈도우 데스크톱 크롬 UA (`PLAYWRIGHT_UA_PROFILE`) */
  userAgent?: string;
};

export async function newContextWithCookiesJson(
  browser: Browser,
  cookiesJsonPath: string,
  options?: NewContextWithCookiesOptions
): Promise<BrowserContext> {
  const ua = resolveDesktopChromeUserAgent(options?.userAgent);
  const raw = await readFile(cookiesJsonPath, "utf8");
  const data = JSON.parse(raw) as unknown;

  if (Array.isArray(data)) {
    const ctx = await browser.newContext({
      userAgent: ua,
    });
    await ctx.addCookies(data as Parameters<BrowserContext["addCookies"]>[0]);
    await applyPlaywrightStealth(ctx);
    return ctx;
  }

  if (data && typeof data === "object" && "cookies" in data) {
    const st = data as { cookies: unknown[]; origins?: unknown[] };
    const state = {
      cookies: st.cookies,
      origins: Array.isArray(st.origins) ? st.origins : [],
    };
    const ctx = await browser.newContext({
      storageState: state as never,
      userAgent: ua,
    });
    await applyPlaywrightStealth(ctx);
    return ctx;
  }

  throw new Error(
    "cookies.json: 배열(쿠키 목록) 또는 { cookies: [...] } 형식이어야 합니다."
  );
}
