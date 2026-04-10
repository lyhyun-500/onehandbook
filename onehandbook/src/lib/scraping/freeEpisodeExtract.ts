import type { Page } from "playwright";

/** 문피아 뷰어 본문 (인간 독자 수집용) — `div.novel-view` / `#content` 우선 */
export const MUNPIA_READER_CONTENT_SELECTORS = [
  "div.novel-view",
  ".novel-view",
  "#content",
  "#novel_content",
  ".novel_view_content",
] as const;

const MUNPIA_READER_UI_LINE =
  /^(다음\s*화|이전\s*화|목록|댓글|로그인|회원가입|신고|공유|즐겨찾기|구매|대여|이용권|TOP|작품\s*선택|최신순|첫화보기|이전화보기|다음화보기|연재\s*중|무료\s*보기|코인|골드|결제|알림|설정|서재|마이페이지|페이지\s*\d+|^\d{1,2}\/\d{1,2}$)/i;

/**
 * 뷰어 주변 UI·짧은 안내 문구 줄 단위로 제거 (본문 단락은 유지)
 */
export function cleanMunpiaReaderNoise(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.replace(/\s+/g, " ").trim();
    if (t.length < 2) continue;
    if (t.length <= 28 && MUNPIA_READER_UI_LINE.test(t)) continue;
    if (/^(AD|광고|Advertisement|Sponsored)/i.test(t)) continue;
    if (/^\d{1,3}$/.test(t)) continue;
    out.push(t);
  }
  return out.join("\n").trim();
}

/**
 * 문피아 뷰어에서 순수 본문 위주 텍스트 추출 (스크롤은 호출 측에서 수행)
 */
export async function extractMunpiaReaderMainText(
  page: Page,
  options?: { minChars?: number }
): Promise<string> {
  const minChars = options?.minChars ?? 100;
  for (const sel of MUNPIA_READER_CONTENT_SELECTORS) {
    const loc = page.locator(sel).first();
    const n = await loc.count().catch(() => 0);
    if (n === 0) continue;
    const text = await loc.innerText().catch(() => "");
    const cleaned = cleanMunpiaReaderNoise(text);
    if (cleaned.replace(/\s/g, "").length >= minChars) return cleaned;
  }
  const fallback = await page.locator("body").innerText().catch(() => "");
  return cleanMunpiaReaderNoise(fallback).slice(0, 100_000);
}

/** 본문 후보 셀렉터 — 사이트 개편 시 .env `FREE_EPISODE_CONTENT_SELECTORS` 로 덮어쓰기 (쉼표 구분) */
export const DEFAULT_CONTENT_SELECTORS_LIST = [
  "article",
  "#novel_content",
  "#episodeContents",
  "#content",
  ".novel_view_content",
  ".detail_view_content",
  "[class*='Article']",
  "[class*='article']",
  "main",
] as const;

function parseSelectors(env: string | undefined): string[] {
  const s = env?.trim();
  if (!s) return [...DEFAULT_CONTENT_SELECTORS_LIST];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 뷰어 본문으로 보이는 영역의 innerText 추출. 너무 짧으면 다음 셀렉터 시도.
 */
export async function extractEpisodeMainText(
  page: Page,
  options?: { minChars?: number; selectorsEnv?: string }
): Promise<string> {
  const minChars = options?.minChars ?? 120;
  const selectors = parseSelectors(options?.selectorsEnv);

  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    const n = await loc.count().catch(() => 0);
    if (n === 0) continue;
    const text = await loc.innerText().catch(() => "");
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length >= minChars) return text.trim();
  }

  const fallback = await page.locator("body").innerText().catch(() => "");
  return fallback.trim().slice(0, 80000);
}
