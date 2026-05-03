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

/** 회차 뷰어 UI에서 읽은 조회·추천 표기 (연독률·몰입 분석용 외생 변수). DOM 개편 시 null 가능 */
export type MunpiaReaderEpisodeEngagement = {
  viewCount: string | null;
  recommendCount: string | null;
};

/**
 * 브라우저에서만 실행되는 스크립트 — 문자열로 넘겨 tsx/esbuild 가 `__name` 등을
 * page.evaluate 콜백에 주입하지 않게 함.
 */
const MUNPIA_READER_ENGAGEMENT_IN_PAGE = `(() => {
  const mergeAcc = (a, b) => ({
    viewCount: a.viewCount != null ? a.viewCount : b.viewCount,
    recommendCount: a.recommendCount != null ? a.recommendCount : b.recommendCount,
  });
  const norm = (s) => s.replace(/\\s+/g, " ").trim();
  const pickNumber = (m, g) => {
    if (!m || !m[g]) return null;
    const v = String(m[g]).trim();
    if (v.length > 0 && v.length <= 28 && /\\d/.test(v)) return v;
    return null;
  };
  const tryViewCount = (t) => {
    if (t.length > 320) return null;
    const patterns = [
      /(?:조회\\s*수?|누적\\s*조회|뷰\\s*수)\\s*[:：]?\\s*([\\d,.]+(?:만|억)?)/i,
      /([\\d,.]+(?:만|억)?)\\s*(?:회\\s*)?조회\\b/i,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const hit = pickNumber(t.match(patterns[i]), 1);
      if (hit) return hit;
    }
    return null;
  };
  const tryRecommendCount = (t) => {
    if (t.length > 320) return null;
    const patterns = [
      /(?:추천\\s*수?|추천\\s*점|추천\\s*합)\\s*[:：]?\\s*([\\d,.]+(?:만|억)?)/i,
      /(?:공감|좋아요)\\s*[:：]?\\s*([\\d,.]+)/i,
      /([\\d,.]+(?:만|억)?)\\s*추천\\b/i,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const hit = pickNumber(t.match(patterns[i]), 1);
      if (hit) return hit;
    }
    return null;
  };
  const scanText = (t) => ({
    viewCount: tryViewCount(t),
    recommendCount: tryRecommendCount(t),
  });
  const isNearTop = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    return r.top >= -40 && r.top < 360 && r.height < 260;
  };
  const elementVisibleText = (el) =>
    el instanceof HTMLElement ? el.innerText || "" : el.textContent || "";
  const selectors = [
    "header",
    "nav",
    '[class*="Header"]',
    '[class*="header"]',
    '[class*="Toolbar"]',
    '[class*="toolbar"]',
    '[id*="header"]',
    '[id*="Header"]',
    '[class*="viewer-top"]',
    '[class*="ViewerTop"]',
    ".novel-header",
  ];
  const roots = [];
  for (let si = 0; si < selectors.length; si++) {
    let list;
    try {
      list = document.querySelectorAll(selectors[si]);
    } catch (e) {
      continue;
    }
    for (let j = 0; j < list.length; j++) {
      const el = list[j];
      if (isNearTop(el)) roots.push(el);
    }
  }
  let acc = { viewCount: null, recommendCount: null };
  const dedupe = new Set();
  for (let ri = 0; ri < roots.length; ri++) {
    const root = roots[ri];
    if (dedupe.has(root)) continue;
    dedupe.add(root);
    const block = norm(elementVisibleText(root));
    acc = mergeAcc(acc, scanText(block));
    const direct = root.querySelector(
      "span, div, li, dd, dt, strong, em, b, p, a, small"
    );
    if (direct) {
      acc = mergeAcc(acc, scanText(norm(direct.textContent || "")));
    }
    if (acc.viewCount && acc.recommendCount) return acc;
  }
  const stickyCandidates = document.querySelectorAll(
    '[class*="sticky"], [class*="fixed"], [class*="Fixed"]'
  );
  for (let i = 0; i < Math.min(stickyCandidates.length, 8); i++) {
    const el = stickyCandidates[i];
    if (!isNearTop(el)) continue;
    const t = norm(elementVisibleText(el));
    if (t.length > 0 && t.length < 500) {
      acc = mergeAcc(acc, scanText(t));
      if (acc.viewCount && acc.recommendCount) return acc;
    }
  }
  return acc;
})()`;

/**
 * 뷰어 상단·툴바 등 **짧은 텍스트 블록**에서만 조회·추천(등) 숫자 추출.
 * 본문 영역은 스캔하지 않아 소설 속 숫자와의 오염을 줄입니다.
 * — 연독률 알고리즘 분석을 위해 회차별 노출 지표를 함께 수집합니다.
 */
export async function extractMunpiaReaderEpisodeEngagement(
  page: Page
): Promise<MunpiaReaderEpisodeEngagement> {
  return page.evaluate(MUNPIA_READER_ENGAGEMENT_IN_PAGE);
}

/** @deprecated 호환용 — `extractMunpiaReaderEpisodeEngagement` 의 viewCount 만 반환 */
export async function extractMunpiaReaderEpisodeViewCount(
  page: Page
): Promise<string | null> {
  const e = await extractMunpiaReaderEpisodeEngagement(page);
  return e.viewCount;
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
