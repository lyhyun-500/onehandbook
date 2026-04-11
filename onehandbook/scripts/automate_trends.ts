/**
 * RAG 트렌드 자동화 파이프라인
 * - Serper: 웹소설 트렌드 검색(지난 24시간)
 * - Playwright: 문피아(모바일+PC 투데이)·카카오페이지·네이버 시리즈(TOP100) 랭킹 스냅샷
 * - Claude: 마크다운 리포트 생성 → data/trends/
 * - 이중 인제스트: ingestData → Supabase trends + 시드니 Chroma
 * - trend_reports_legacy: 데일리 리포트 메타(구 reports 트렌드용 테이블)
 * - node-cron: 매일 04:00 (Asia/Seoul) — `--cron` 일 때만
 *
 * 실행: npx tsx scripts/automate_trends.ts
 *       npx tsx scripts/automate_trends.ts --cron
 *       npx tsx scripts/automate_trends.ts --dry-run
 *
 * 문피아 독자뷰 파이프라인 (`--munpia-scrape`):
 *   - 자동: MUNPIA_READER_WORKS_JSON 비우고 실행 → 모바일 베스트 스냅샷(상위 40)·어제 대비 급상승/신규 20위 진입 우선, 미인제스트 1~20위 최대 5작.
 *   - 수동: MUNPIA_READER_WORKS_JSON='[{"title":"…","urls":["https://novel.munpia.com/…"]}]'
 *   data/cookies.json 세션, HEADLESS=0 권장. 부하: MUNPIA_READER_BETWEEN_WORKS_MS_MIN/MAX
 *
 * 필요: ANTHROPIC_API_KEY, SERPER_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *       NEXT_PUBLIC_SUPABASE_URL, (선택) CHROMA_SERVER_HOST=54.252.238.168
 * Playwright: npx playwright install chromium
 */

import { mkdir, writeFile, access, open, unlink } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import dotenv from "dotenv";
import nodeCron from "node-cron";
import { chromium, type Browser, type Page } from "playwright";
import { ANALYSIS_CLAUDE_MODEL } from "@/config/analysis-profiles";
import { completeAnthropic } from "@/lib/ai/providers/anthropic";
import { ingestData } from "@/lib/trends/ingestData";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { newContextWithCookiesJson } from "@/lib/scraping/playwrightCookies";
import { chromiumLaunchOptions } from "@/lib/scraping/chromiumLaunchOptions";
import { extractMunpiaReaderMainText } from "@/lib/scraping/freeEpisodeExtract";
import {
  buildMunpiaBestListExtractorExpression,
  buildEpisodeNumberCollectorExpression,
  buildNeSrlEpisodeCollectorExpression,
  buildNeSrlEpisodeCollectorOrderedExpression,
  buildNovelTocUrl,
  DEFAULT_MUNPIA_BEST_MOBILE_URL,
  extractNovelKeyFromMunpiaUrl,
  fetchMunpiaReaderIngestedNovelKeys,
  getYmdInTimeZone,
  loadMunpiaBestSnapshot,
  planMunpiaReaderTargets,
  saveMunpiaBestSnapshot,
  type MunpiaBestItem,
  type MunpiaBestSnapshot,
} from "@/lib/scraping/munpiaReaderSelection";

dotenv.config({ path: ".env.local" });

const LOG = "[automate-trends]";
const CRON_MARKERS_DIR = join(process.cwd(), "data", "trends", "cron-markers");
const LOCK_DIR = join(process.cwd(), "data", "trends", "locks");

async function refreshCoinStatsForTodayUtc(): Promise<void> {
  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    console.warn(
      `${LOG} [coin-stats] SUPABASE_SERVICE_ROLE_KEY 미설정 — 스킵`
    );
    return;
  }

  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const ymd = `${y}-${m}-${day}`;

  const { data, error } = await admin.rpc("refresh_coin_stats", {
    p_from: ymd,
    p_to: ymd,
  });

  if (error) {
    console.error(`${LOG} [coin-stats] refresh_coin_stats 실패:`, error.message);
    return;
  }
  const json = data as { ok?: boolean; error?: string } | null;
  if (!json || json.ok !== true) {
    console.error(
      `${LOG} [coin-stats] refresh_coin_stats 실패:`,
      json?.error ?? "unknown_error"
    );
    return;
  }
  console.info(`${LOG} [coin-stats] 배치 적재 완료 (UTC=${ymd})`);
}

function commanderAlertWebhookUrl(): string | null {
  const v =
    process.env.COMMANDER_ALERT_WEBHOOK_URL?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim();
  if (!v) return null;
  // .env에 따옴표로 감싸 넣는 경우를 방지
  const unquoted = v.replace(/^['"]+/, "").replace(/['"]+$/, "").trim();
  return unquoted ? unquoted : null;
}

async function notifyCommander(text: string): Promise<void> {
  const url = commanderAlertWebhookUrl();
  if (!url) {
    console.warn(`${LOG} [alert] webhook 미설정: ${text}`);
    return;
  }
  try {
    // Slack Incoming Webhook 호환: { text }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      console.warn(
        `${LOG} [alert] webhook 실패 HTTP ${res.status}: ${b.slice(0, 200)}`
      );
    }
  } catch (e) {
    console.warn(
      `${LOG} [alert] webhook 전송 실패:`,
      e instanceof Error ? e.message : e
    );
  }
}

function dailyDoneMarkerPath(ymd: string): string {
  return join(CRON_MARKERS_DIR, `daily-done-${ymd}.json`);
}

async function writeDailyDoneMarker(ymd: string): Promise<void> {
  await mkdir(CRON_MARKERS_DIR, { recursive: true });
  await writeFile(
    dailyDoneMarkerPath(ymd),
    JSON.stringify({ ymd, doneAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

async function waitForDailyDoneMarker(
  ymd: string,
  opts?: { timeoutMs?: number; pollMs?: number }
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 12 * 60_000;
  const pollMs = opts?.pollMs ?? 10_000;
  const until = Date.now() + timeoutMs;
  const p = dailyDoneMarkerPath(ymd);
  while (Date.now() < until) {
    try {
      await access(p);
      return true;
    } catch {
      /* not yet */
    }
    await sleep(pollMs);
  }
  return false;
}

type LockHandle = { path: string };

async function tryAcquireLock(name: string): Promise<LockHandle | null> {
  await mkdir(LOCK_DIR, { recursive: true });
  const p = join(LOCK_DIR, `${name}.lock.json`);
  try {
    const fh = await open(p, "wx");
    await fh.writeFile(
      JSON.stringify(
        {
          name,
          pid: process.pid,
          startedAt: new Date().toISOString(),
          argv: process.argv,
        },
        null,
        2
      ),
      "utf8"
    );
    await fh.close();
    return { path: p };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/EEXIST|already exists/i.test(msg)) return null;
    throw e;
  }
}

async function releaseLock(lock: LockHandle | null): Promise<void> {
  if (!lock) return;
  await unlink(lock.path).catch(() => {});
}

function shouldAbortOnStatus(status: number): boolean {
  if (status === 403 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

function munpiaBackoffMs(): number {
  const def = 20 * 60_000;
  const raw = Number(process.env.MUNPIA_READER_BACKOFF_MS ?? def);
  const n = Number.isFinite(raw) ? Math.floor(raw) : def;
  return Math.max(30_000, Math.min(6 * 60 * 60_000, n));
}

async function gotoChecked(
  page: Page,
  url: string,
  label: string
): Promise<void> {
  const res = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  const status = res?.status?.() ?? null;
  if (typeof status === "number" && shouldAbortOnStatus(status)) {
    throw new Error(
      `${label}: HTTP ${status} 감지 → 부하 완화를 위해 즉시 중단(백오프)`
    );
  }

  // 쿠키 만료/로그아웃 감지: nssl 로그인 폼 또는 로그인 페이지로 리다이렉트
  const currentUrl = page.url();
  const looksLikeLogin =
    currentUrl.includes("nssl.munpia.com/login") ||
    (await page.locator("#username, #password, form#loginForm").first().isVisible().catch(() => false));
  if (looksLikeLogin) {
    const msg =
      "사령관님, 쿠키가 구워진 지 오래되어 상했습니다. 새로 구워주십시오! (문피아 로그인 화면 감지)";
    await notifyCommander(`${msg}\n- url: ${currentUrl}\n- label: ${label}`);
    throw new Error(`${label}: 쿠키 만료로 로그인 화면 감지`);
  }
}

function seoulDateForCron(): Date {
  // cron 스케줄이 Asia/Seoul 기준이므로, 여기서는 local Date로 충분
  return new Date();
}

function nextCronTimeTodaySeoul(h: number, m: number): Date {
  const d = seoulDateForCron();
  d.setHours(h, m, 0, 0);
  return d;
}

function randomMunpiaStartDelayMs(): number {
  // 04:10 ~ 06:00 사이 랜덤 시작 (최대 110분)
  const min = 0;
  const max = 110 * 60_000;
  const raw = Math.floor(Math.random() * (max - min + 1)) + min;
  const capEnv = Number(process.env.MUNPIA_CRON_RANDOM_DELAY_MAX_MS ?? max);
  const cap = Number.isFinite(capEnv) ? Math.max(0, Math.min(max, capEnv)) : max;
  return Math.min(raw, cap);
}

/** 시드니 Chroma 기본 (ingestData와 동일 기본값) */
const DEFAULT_CHROMA_HOST = "54.252.238.168";
const DEFAULT_CHROMA_PORT = 8000;

const MUNPIA_RANK_URL =
  process.env.MUNPIA_RANKING_URL?.trim() ||
  "https://m.munpia.com/genres/best/novels";
/** PC 웹 — 무료 웹소설 투데이 베스트(최근 24시간 연재 조회 기준) */
const MUNPIA_TODAY_BEST_URL =
  process.env.MUNPIA_TODAY_BEST_URL?.trim() ||
  "https://www.munpia.com/page/j/view/w/best/today?displayType=GRID";
const KAKAO_RANK_URL =
  process.env.KAKAO_RANKING_URL?.trim() ||
  "https://page.kakao.com/menu/10011/screen/94";
/** 네이버 시리즈 웹소설 TOP100 — 기본 일간(전체 장르) */
const NAVER_SERIES_RANK_URL =
  process.env.NAVER_SERIES_RANKING_URL?.trim() ||
  "https://series.naver.com/novel/top100List.series?categoryCode=ALL&rankingTypeCode=DAILY";

const TRENDS_DIR = join(process.cwd(), "data", "trends");

/** 최신 맥 크롬 UA (자동화 탐지 완화 — 주기적으로 버전만 올려도 됨) */
const CHROME_MAC_RECENT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const MUNPIA_READER_MAX_WORKS = 10;

type SerperOrganic = { title?: string; snippet?: string; link?: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const max = opts?.maxAttempts ?? 4;
  const base = opts?.baseDelayMs ?? 800;
  let last: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `${LOG} ${label} 실패 (${attempt}/${max}): ${msg}`
      );
      if (attempt < max) {
        const delay = base * Math.pow(2, attempt - 1);
        console.info(`${LOG} ${label} ${delay}ms 후 재시도`);
        await sleep(delay);
      }
    }
  }
  throw last instanceof Error
    ? last
    : new Error(`${label}: ${String(last)}`);
}

async function fetchSerperWebTrends(apiKey: string): Promise<string> {
  const queries = [
    "웹소설 트렌드 인기 장르",
    "웹소설 급상승 키워드",
    "문피아 카카오페이지 네이버 시리즈 인기작",
  ];
  const blocks: string[] = [];

  for (const q of queries) {
    const text = await withRetry(
      `Serper("${q.slice(0, 16)}…")`,
      async () => {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({
            q,
            num: 12,
            gl: "kr",
            hl: "ko",
            tbs: "qdr:d",
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${errBody.slice(0, 200)}`);
        }
        return res.json() as Promise<{
          organic?: SerperOrganic[];
          answerBox?: { answer?: string };
        }>;
      },
      { maxAttempts: 3, baseDelayMs: 1000 }
    );

    const lines: string[] = [];
    if (text.answerBox?.answer) {
      lines.push(`요약: ${text.answerBox.answer}`);
    }
    for (const o of text.organic ?? []) {
      const t = (o.title ?? "").trim();
      const s = (o.snippet ?? "").trim();
      const l = (o.link ?? "").trim();
      if (!t && !s) continue;
      lines.push(`- ${t}${l ? ` (${l})` : ""}${s ? ` — ${s}` : ""}`);
    }
    if (lines.length > 0) {
      blocks.push(`### 검색: ${q}\n${lines.join("\n")}`);
    }
  }

  return blocks.length > 0
    ? blocks.join("\n\n")
    : "(Serper 유기적 결과 없음)";
}

function dedupeTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 2) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * tsx가 page.evaluate 함수에 `__name` 등을 주입해 브라우저에서 ReferenceError가 나므로,
 * IIFE 문자열로만 전달한다.
 */
function buildRankingExtractorExpression(limRaw: number): string {
  const lim = Math.floor(Number(limRaw));
  if (!Number.isFinite(lim) || lim < 1 || lim > 200) {
    throw new Error(`scrape limit invalid: ${limRaw}`);
  }
  return `(() => {
    var lim = ${lim};
    var seen = new Set();
    var out = [];
    function push(raw) {
      var t = String(raw == null ? "" : raw).replace(/\\s+/g, " ").trim();
      if (t.length < 2 || t.length > 120) return;
      if (/^(다음|이전|더보기|TOP|랭킹|메뉴|로그인|회원가입)$/i.test(t)) return;
      if (seen.has(t)) return;
      seen.add(t);
      out.push(t);
    }
    var anchors = document.querySelectorAll("a");
    for (var i = 0; i < anchors.length; i++) {
      if (out.length >= lim) break;
      var a = anchors[i];
      var href = a.getAttribute("href") || "";
      var txt = a.textContent;
      if (!txt) continue;
      if (
        href.indexOf("novel") !== -1 ||
        href.indexOf("Novel") !== -1 ||
        href.indexOf("content") !== -1 ||
        href.indexOf("product") !== -1 ||
        href.indexOf("series") !== -1 ||
        href.indexOf("series.naver.com") !== -1 ||
        href.indexOf("munpia.com") !== -1 ||
        href.indexOf("/view/") !== -1
      ) {
        push(txt);
      }
    }
    if (out.length < lim) {
      var nodes = document.querySelectorAll("li, article, [class*='item']");
      for (var j = 0; j < nodes.length; j++) {
        if (out.length >= lim) break;
        var el = nodes[j];
        var tc = el.textContent;
        var firstLine = tc ? tc.split("\\n")[0] : "";
        push(firstLine);
      }
    }
    return out.slice(0, lim);
  })()`;
}

/**
 * 링크 텍스트 기반으로 작품명 후보 추출 (DOM 구조 변경에 어느 정도 강함)
 */
async function scrapeTopTitles(
  browser: Browser,
  url: string,
  label: string,
  limit: number
): Promise<string[]> {
  return withRetry(
    `Playwright ${label}`,
    async () => {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await new Promise((r) => setTimeout(r, 2500));
        const expr = buildRankingExtractorExpression(limit);
        const titles = (await page.evaluate(expr)) as string[];
        return titles;
      } finally {
        await page.close().catch(() => {});
      }
    },
    { maxAttempts: 2, baseDelayMs: 2000 }
  );
}

async function collectRankings(): Promise<{
  munpia: string[];
  kakao: string[];
  naverSeries: string[];
}> {
  let browser: Browser | null = null;
  try {
    browser = await withRetry(
      "Playwright launch",
      () =>
        chromium.launch(chromiumLaunchOptions(true)),
      { maxAttempts: 2, baseDelayMs: 1500 }
    );
    // EC2 소형 인스턴스 등: Promise.all(4탭) 동시 오픈 시 RAM 피크로 Page crashed 빈번 → 순차 수집
    const munpiaMobile = await scrapeTopTitles(
      browser,
      MUNPIA_RANK_URL,
      "문피아(모바일 베스트)",
      20
    ).catch((e) => {
      console.error(`${LOG} 문피아 모바일 랭킹 스킵:`, e);
      return [] as string[];
    });
    const munpiaToday = await scrapeTopTitles(
      browser,
      MUNPIA_TODAY_BEST_URL,
      "문피아(PC 투데이 베스트)",
      20
    ).catch((e) => {
      console.error(`${LOG} 문피아 PC 투데이 스킵:`, e);
      return [] as string[];
    });
    const kakao = await scrapeTopTitles(
      browser,
      KAKAO_RANK_URL,
      "카카오페이지",
      20
    ).catch((e) => {
      console.error(`${LOG} 카카오 랭킹 스킵:`, e);
      return [] as string[];
    });
    const naverSeries = await scrapeTopTitles(
      browser,
      NAVER_SERIES_RANK_URL,
      "네이버 시리즈 TOP100",
      20
    ).catch((e) => {
      console.error(`${LOG} 네이버 시리즈 랭킹 스킵:`, e);
      return [] as string[];
    });
    const munpia = dedupeTitles([...munpiaMobile, ...munpiaToday]).slice(0, 40);
    return { munpia, kakao, naverSeries };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function buildMarkdownWithClaude(input: {
  serperBlock: string;
  munpia: string[];
  kakao: string[];
  naverSeries: string[];
  targetDateYmd: string;
}): Promise<string> {
  const munpiaList =
    input.munpia.length > 0
      ? input.munpia.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(수집 실패 또는 빈 목록)";
  const kakaoList =
    input.kakao.length > 0
      ? input.kakao.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(수집 실패 또는 빈 목록)";
  const naverList =
    input.naverSeries.length > 0
      ? input.naverSeries.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(수집 실패 또는 빈 목록)";

  const system = `당신은 한국 웹소설 시장 트렌드 분석가입니다.
아래 **원시 수집 데이터**만 근거로 마크다운 리포트를 작성합니다. 없는 사실을 지어내지 마세요.
출력은 **마크다운 본문만**(앞뒤 설명 문구 없이).

**필수:** 플랫폼은 **문피아·카카오페이지·네이버 시리즈** 세 곳 모두 다룹니다. \`### 플랫폼 랭킹 요약\` 아래에 \`#### 문피아\` / \`#### 카카오페이지\` / \`#### 네이버 시리즈\` 를 **빠짐없이** 넣고, \`### 종합 인사이트\` 에서도 세 플랫폼을 **각각 최소 한 문장 이상** 언급하세요. 네이버 시리즈 데이터가 비어 있으면 그 사실을 명시하세요.`;

  const user = `
## 수집일(기준): ${input.targetDateYmd}
※ Serper는 지난 24시간(qdr:d) 검색 결과 위주입니다. 랭킹은 수집 시점 스냅샷입니다.

## Serper 웹 검색 요약
${input.serperBlock}

## 문피아 랭킹 스냅샷 (모바일 베스트 + PC 투데이 베스트 병합·중복 제거, 최대 40)
${munpiaList}

## 카카오페이지 랭킹 상위 스냅샷 (최대 20)
${kakaoList}

## 네이버 시리즈 웹소설 TOP100 스냅샷 (최대 20, 기본 일간·전체 장르)
${naverList}

---

다음 **고정 구조**를 반드시 지키세요 (제목·순서 동일):

1) 첫 줄부터 YAML 프론트매터만 출력:
---
genre: 전체
date: ${input.targetDateYmd}
source: Serper·문피아·카카오·네이버시리즈 자동수집 (${input.targetDateYmd})
---

2) 본문 섹션:
### 급상승·주목 키워드
(불릿 4~8개, 수집 데이터와 일치하는 범위에서만)

### Serper 웹 트렌드 요약
(2~4문단)

### 플랫폼 랭킹 요약
#### 문피아
(불릿 또는 짧은 문단)
#### 카카오페이지
(불릿 또는 짧은 문단)
#### 네이버 시리즈
(불릿 또는 짧은 문단)

### 종합 인사이트
(작가에게 도움이 되는 2~4문단, 과장 금지. **문피아·카카오페이지·네이버 시리즈**를 모두 논의할 것)
`;

  const raw = await withRetry(
    "Claude 리포트",
    () =>
      completeAnthropic({
        model: ANALYSIS_CLAUDE_MODEL,
        system,
        user,
      }),
    { maxAttempts: 3, baseDelayMs: 2000 }
  );

  return finalizeDailyTrendMarkdown(
    raw.replace(/^\uFEFF/, "").trim(),
    input.targetDateYmd,
    input.naverSeries
  );
}

/** LLM이 네이버·source 줄을 누락하는 경우 보정 */
function finalizeDailyTrendMarkdown(
  md: string,
  ymd: string,
  naverTitles: string[]
): string {
  let out = md;
  const requiredSource = `source: Serper·문피아·카카오·네이버시리즈 자동수집 (${ymd})`;

  const fmMatch = out.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    let inner = fmMatch[1];
    if (/^source:/m.test(inner)) {
      inner = inner.replace(/^source:\s*.+$/m, requiredSource);
    } else {
      inner = `${inner.trimEnd()}\n${requiredSource}`;
    }
    out = out.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${inner}\n---`);
  } else {
    out = out.replace(/^source:\s*.+$/m, requiredSource);
  }

  if (!/####\s*네이버\s*시리즈/.test(out)) {
    const lines =
      naverTitles.length > 0
        ? naverTitles
            .slice(0, 20)
            .map((t, i) => `- ${i + 1}. ${t}`)
            .join("\n")
        : "- (이번 실행에서 네이버 시리즈 랭킹에서 작품명을 추출하지 못했습니다. URL·DOM·접속 제한을 확인하세요.)";
    const block = `#### 네이버 시리즈\n\n${lines}\n\n`;
    const anchor = "### 종합 인사이트";
    const pos = out.indexOf(anchor);
    if (pos !== -1) {
      out = out.slice(0, pos) + block + out.slice(pos);
    } else {
      out = `${out}\n\n${block}`;
    }
  }

  return out;
}

async function saveTrendFile(
  ymd: string,
  markdown: string
): Promise<string> {
  await mkdir(TRENDS_DIR, { recursive: true });
  const name = `daily-trend-${ymd}.md`;
  const full = join(TRENDS_DIR, name);
  await writeFile(full, markdown, "utf8");
  console.info(`${LOG} 파일 저장: ${full}`);
  return full;
}

async function insertTrendReportLegacy(params: {
  title: string;
  body: string;
  reportDateYmd: string;
  extra: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseServiceRole();
  const { error } = await supabase.from("trend_reports_legacy").insert({
    title: params.title,
    body: params.body,
    genre: "전체",
    report_date: params.reportDateYmd,
    citation_source: "automate_trends 파이프라인",
    extra: params.extra,
  });
  if (error) {
    console.error(
      `${LOG} trend_reports_legacy 저장 실패(무시 가능):`,
      error.message
    );
    return;
  }
  console.info(`${LOG} trend_reports_legacy 저장 완료: ${params.title}`);
}

type MunpiaReaderWorkGroup = {
  title: string;
  urls: string[];
  /** 선택 — 없으면 novel/detail/{id} 로 추론 */
  detailUrl?: string;
};

type MunpiaReaderTask = {
  title: string;
  novelKey: string;
  detailUrl: string;
  manualEpisodeUrls?: string[];
  munpiaRank: number;
  isRisingStar: boolean;
  risingReason: string | null;
};

function computeTrendDedupId(title: string, platform: string, targetDateYmd: string): string {
  return createHash("sha256")
    .update(`${title}|${platform}|${targetDateYmd}`)
    .digest("hex");
}

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function munpiaReaderMaxWorksPerRun(): number {
  const raw = process.env.MUNPIA_READER_MAX_WORKS_PER_RUN?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }
  return MUNPIA_READER_MAX_WORKS;
}

function betweenWorksDelayMs(): number {
  const defMin = 5500;
  const defMax = 11000;
  const min = Number(
    process.env.MUNPIA_READER_BETWEEN_WORKS_MS_MIN ?? defMin
  );
  const max = Number(
    process.env.MUNPIA_READER_BETWEEN_WORKS_MS_MAX ?? defMax
  );
  return randomIntInclusive(Math.min(min, max), Math.max(min, max));
}

function episodeWaitMs(): number {
  const defMin = 3000;
  const defMax = 5000;
  const min = Number(process.env.MUNPIA_READER_EPISODE_WAIT_MS_MIN ?? defMin);
  const max = Number(process.env.MUNPIA_READER_EPISODE_WAIT_MS_MAX ?? defMax);
  return randomIntInclusive(Math.min(min, max), Math.max(min, max));
}

function betweenEpisodesMs(): number {
  const defMin = 3000;
  const defMax = 5000;
  const min = Number(
    process.env.MUNPIA_READER_BETWEEN_EPISODES_MS_MIN ?? defMin
  );
  const max = Number(
    process.env.MUNPIA_READER_BETWEEN_EPISODES_MS_MAX ?? defMax
  );
  return randomIntInclusive(Math.min(min, max), Math.max(min, max));
}

function scrollMaxMs(): number {
  const def = 10_000;
  const raw = Number(process.env.MUNPIA_READER_SCROLL_MAX_MS ?? def);
  const n = Number.isFinite(raw) ? Math.floor(raw) : def;
  return Math.max(2000, Math.min(20_000, n));
}

/** 예: MUNPIA_READER_FILTER_RANKS=1 또는 1,2,3 (자동 모드에서만 적용) */
function parseMunpiaReaderRankFilter(): Set<number> | null {
  const raw = process.env.MUNPIA_READER_FILTER_RANKS?.trim();
  if (!raw) return null;
  const s = new Set<number>();
  for (const p of raw.split(",")) {
    const n = Number.parseInt(p.trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 40) s.add(n);
  }
  return s.size > 0 ? s : null;
}

function munpiaReaderIgnoreDuplicates(): boolean {
  const v = process.env.MUNPIA_READER_IGNORE_DUPLICATE?.trim();
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function parseMunpiaReaderWorks(): MunpiaReaderWorkGroup[] {
  const raw = process.env.MUNPIA_READER_WORKS_JSON?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("MUNPIA_READER_WORKS_JSON JSON 파싱 실패");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("MUNPIA_READER_WORKS_JSON 은 JSON 배열이어야 합니다.");
  }
  const out: MunpiaReaderWorkGroup[] = [];
  for (const item of parsed.slice(0, MUNPIA_READER_MAX_WORKS)) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      title?: unknown;
      urls?: unknown;
      detailUrl?: unknown;
    };
    const title = String(o.title ?? "제목미정").trim() || "제목미정";
    if (!Array.isArray(o.urls)) continue;
    const urls = o.urls
      .map((u) => String(u).trim())
      .filter(Boolean)
      .slice(0, 30);
    if (urls.length === 0) continue;
    const detailUrl =
      typeof o.detailUrl === "string" && o.detailUrl.trim()
        ? o.detailUrl.trim()
        : undefined;
    out.push({ title, urls, detailUrl });
  }
  return out.slice(0, MUNPIA_READER_MAX_WORKS);
}

function assertMunpiaUrls(urls: string[]): void {
  for (const u of urls) {
    if (!/munpia\.com/i.test(u)) {
      throw new Error(`문피아 도메인 URL만 허용됩니다: ${u}`);
    }
  }
}

function slugForMunpiaReaderFile(title: string): string {
  const s = title
    .replace(/\s+/g, "-")
    .replace(/[^\w\uac00-\ud7a3-]+/g, "")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return s || "work";
}

async function humanReadScroll(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport) {
    await page.mouse.move(
      Math.floor(viewport.width * 0.5),
      Math.floor(viewport.height * 0.45)
    );
  }
  const hardStop = Date.now() + scrollMaxMs();
  while (Date.now() < hardStop) {
    await page.mouse.wheel(0, randomIntInclusive(300, 600));
    await sleep(randomIntInclusive(220, 520));
  }
  await sleep(randomIntInclusive(120, 320));
}

async function scrapeMunpiaWorkEpisodesHumanLike(
  page: Page,
  urls: string[],
  workLabel: string,
  options?: { tocUrl?: string; exitToTocEvery?: number }
): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) {
      const gap = betweenEpisodesMs();
      console.info(
        `${LOG} [munpia-reader] "${workLabel}" 회차 간 대기 ${gap}ms`
      );
      await sleep(gap);
    }
    await sleep(randomIntInclusive(120, 420));

    console.info(
      `${LOG} [munpia-reader] "${workLabel}" ${i + 1}/${urls.length}화 로딩`
    );
    await gotoChecked(page, urls[i], "문피아 뷰어 진입");
    const afterEnter = episodeWaitMs();
    console.info(
      `${LOG} [munpia-reader] "${workLabel}" ${i + 1}화 — 본문 수집 전 ${afterEnter}ms (독자 대기)`
    );
    await sleep(afterEnter);

    await humanReadScroll(page);

    const text = await extractMunpiaReaderMainText(page);
    parts.push(`### [${workLabel} ${i + 1}화 뷰어 본문]\n${text}`);

    // 긴 회차 묶음(예: 15화)에서는 중간에 목차로 나갔다가 들어오는 동작을 섞어 자연스러운 흐름을 만듭니다.
    const every = options?.exitToTocEvery ?? 0;
    if (
      every > 0 &&
      options?.tocUrl &&
      (i + 1) % every === 0 &&
      i + 1 < urls.length
    ) {
      await gotoChecked(page, options.tocUrl, "문피아 목차(중간 이탈) 진입");
      await sleep(randomIntInclusive(900, 1800));
    }
  }
  return parts.join("\n\n---\n\n");
}

async function buildMunpiaReaderMarkdownWithClaude(
  rawCorpus: string,
  workTitle: string,
  targetDateYmd: string,
  readerMeta?: {
    isRisingStar: boolean;
    risingReason: string | null;
    munpiaRank: number;
  }
): Promise<string> {
  const capped = rawCorpus.slice(0, 48_000);
  const system = `당신은 한국 웹소설을 깊게 읽는 독자이자 편집자입니다. 제공된 뷰어 본문에 없는 사실은 추측하지 말고, 없으면 "본문만으로는 판단 어려움"이라고 짧게 적으세요.
출력은 마크다운 본문만 (앞뒤 인사·코드펜스 없음).`;

  const risingLine =
    readerMeta?.isRisingStar === true
      ? `\n베스트 차트 메타: 급상승/신규 진입 작품(rising_reason=${readerMeta.risingReason ?? "unknown"}, 당일 순위=${readerMeta.munpiaRank}). 분석 톤에 반영해도 좋습니다.\n`
      : "";

  const user = `작품명(참고): ${workTitle}
수집일: ${targetDateYmd}
${risingLine}
아래 텍스트는 문피아 뷰어에서 추출한 여러 회차 구간입니다.

**독자 입장에서 이 소설의 맛이 무엇인지**(왜 계속 읽고 싶어지는지, 톤·몰입 포인트)를 중심으로 분석해 주세요.

반드시 아래 **세 개의 소제목**을 이 순서·표기(한글·# 개수) 그대로 포함하세요:

### 문체 특징
(2~8문장)

### 주인공의 결핍
(2~8문장, 본문에 드러난 범위에서만)

### 1~5화 사이의 터닝포인트
(불릿 또는 짧은 문단. 실제 수집 회차가 5화 미만이면 그 구간에 맞춰 서술)

---
본문:
${capped}`;

  const raw = await withRetry(
    "Claude 문피아 독자뷰 요약",
    () =>
      completeAnthropic({
        model: ANALYSIS_CLAUDE_MODEL,
        system,
        user,
      }),
    { maxAttempts: 3, baseDelayMs: 2000 }
  );
  return raw.replace(/^\uFEFF/, "").trim();
}

function wrapMunpiaReaderSavedMarkdown(
  title: string,
  ymd: string,
  analysisBody: string,
  meta: {
    munpiaNovelKey: string;
    munpiaRank: number;
    isRisingStar: boolean;
    risingReason: string | null;
  }
): string {
  const safeTitle = title.replace(/:/g, "—");
  const reasonYaml =
    meta.risingReason == null || meta.risingReason === ""
      ? "null"
      : JSON.stringify(meta.risingReason);
  return `---
title: ${safeTitle}
genre: 전체
date: ${ymd}
source: 문피아 뷰어 수집(쿠키 세션) · Claude 독자 관점 요약
munpia_novel_key: "${meta.munpiaNovelKey}"
munpia_rank: ${meta.munpiaRank}
is_rising_star: ${meta.isRisingStar ? "true" : "false"}
rising_reason: ${reasonYaml}
---

${analysisBody}
`;
}

async function munpiaReaderVisitWorkDetail(
  page: Page,
  detailUrl: string
): Promise<void> {
  await gotoChecked(page, detailUrl, "문피아 상세 진입");
  const dwell = randomIntInclusive(2000, 2600);
  console.info(
    `${LOG} [munpia-reader] 상세(소개·태그) 체류 ${dwell}ms`
  );
  await sleep(dwell);
  const vp = page.viewportSize();
  if (vp) {
    await page.mouse.move(
      Math.floor(vp.width * 0.5),
      Math.floor(vp.height * 0.35)
    );
  }
  await page.mouse.wheel(0, randomIntInclusive(200, 450));
  await sleep(randomIntInclusive(350, 700));
  await page.mouse.wheel(0, randomIntInclusive(120, 320));
  await sleep(randomIntInclusive(400, 800));
}

async function munpiaReaderDiscoverEpisodeUrls(
  page: Page,
  novelKey: string,
  desiredMaxEpisodeNo: number
): Promise<string[]> {
  const maxEp = Math.max(1, Math.min(15, Math.floor(desiredMaxEpisodeNo)));
  const targets = Array.from({ length: maxEp }, (_, i) => i + 1);

  // 1) 우선: 회차 번호(1~N) 기반으로 정확히 URL 매칭
  // 많은 작품이 최신순 목차라 page/1~3에서는 1~N을 못 찾을 수 있어,
  // 관용적으로 큰 page로 점프(page/9999)해서 초기 회차를 찾습니다.
  const scanPagesEnv = Number(process.env.MUNPIA_READER_EPISODE_NO_SCAN_PAGES ?? 3);
  const scanPages =
    Number.isFinite(scanPagesEnv) && scanPagesEnv >= 1 && scanPagesEnv <= 6
      ? Math.floor(scanPagesEnv)
      : 3;

  const found = new Map<number, string>();
  for (let i = 0; i < scanPages; i++) {
    const p = 9999 - i;
    const url = `https://novel.munpia.com/${novelKey}/page/${p}`;
    await gotoChecked(page, url, "문피아 목차(끝쪽) 진입");
    await sleep(randomIntInclusive(900, 1600));

    const expr = buildEpisodeNumberCollectorExpression(novelKey, targets);
    const map = (await page.evaluate(expr)) as Record<string, string>;
    if (map && typeof map === "object") {
      for (const k of Object.keys(map)) {
        const ep = Number.parseInt(k, 10);
        const u = map[k];
        if (!Number.isFinite(ep) || !u) continue;
        if (!found.has(ep)) found.set(ep, u);
      }
    }
    if (targets.every((t) => found.has(t))) break;
    await sleep(randomIntInclusive(650, 1300));
  }

  const numbered = targets.map((t) => found.get(t)).filter(Boolean) as string[];
  if (numbered.length >= Math.min(5, maxEp)) {
    return numbered.slice(0, maxEp);
  }

  // 2) 폴백: 목차 page/1~N(기본 3)에서 최하단 회차를 가져오기
  await sleep(randomIntInclusive(500, 1200));
  const maxPageToCheck = Math.min(
    3,
    Math.max(1, Number(process.env.MUNPIA_READER_TOC_MAX_PAGE ?? 3) || 3)
  );
  const collected: string[] = [];
  const seen = new Set<string>();

  for (let p = maxPageToCheck; p >= 1; p--) {
    const url =
      p === 1
        ? buildNovelTocUrl(novelKey)
        : `https://novel.munpia.com/${novelKey}/page/${p}`;
    await gotoChecked(page, url, "문피아 목차(page 1~3) 진입");
    await sleep(randomIntInclusive(900, 1600));

    const expr = buildNeSrlEpisodeCollectorOrderedExpression(novelKey);
    const urls = (await page.evaluate(expr)) as string[];
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    for (let j = list.length - 1; j >= 0; j--) {
      const u = list[j];
      if (seen.has(u)) continue;
      seen.add(u);
      collected.push(u);
      if (collected.length >= Math.min(5, maxEp)) break;
    }
    if (collected.length >= Math.min(5, maxEp)) break;
    await sleep(randomIntInclusive(650, 1300));
  }
  if (collected.length > 0) return collected.reverse().slice(0, Math.min(5, maxEp));

  // 3) 최후 폴백: page/1에서 앞 5개
  await gotoChecked(page, buildNovelTocUrl(novelKey), "문피아 목차 폴백 진입");
  await sleep(randomIntInclusive(900, 1600));
  const fallbackExpr = buildNeSrlEpisodeCollectorExpression(novelKey);
  const fb = (await page.evaluate(fallbackExpr)) as string[];
  return Array.isArray(fb) ? fb.filter(Boolean).slice(0, Math.min(5, maxEp)) : [];
}

async function scrapeMunpiaFullWorkReaderPath(
  page: Page,
  opts: {
    title: string;
    novelKey: string;
    detailUrl: string;
    manualEpisodeUrls?: string[];
    desiredMaxEpisodeNo: number;
    exitToTocEvery?: number;
  }
): Promise<string> {
  await munpiaReaderVisitWorkDetail(page, opts.detailUrl);
  let episodeUrls: string[];
  if (opts.manualEpisodeUrls && opts.manualEpisodeUrls.length > 0) {
    await sleep(randomIntInclusive(800, 1800));
    episodeUrls = opts.manualEpisodeUrls.slice(0, Math.min(5, opts.desiredMaxEpisodeNo));
  } else {
    episodeUrls = await munpiaReaderDiscoverEpisodeUrls(
      page,
      opts.novelKey,
      opts.desiredMaxEpisodeNo
    );
  }
  if (episodeUrls.length === 0) {
    throw new Error(`${opts.title}: 무료 회차 URL을 찾지 못했습니다.`);
  }
  assertMunpiaUrls(episodeUrls);
  return scrapeMunpiaWorkEpisodesHumanLike(
    page,
    episodeUrls,
    opts.title,
    {
      tocUrl: buildNovelTocUrl(opts.novelKey),
      exitToTocEvery: opts.exitToTocEvery ?? 0,
    }
  );
}

/**
 * 문피아 쿠키 세션 + 베스트 자동 선정(1~20·급상승) 또는 MUNPIA_READER_WORKS_JSON 수동
 * → 작품 상세 체류 → 목차(또는 지정 URL) → 뷰어 1~5화 인간 패턴 수집
 * → Claude 요약 → data/trends/*.md + ingestData(Chroma)
 */
export async function runMunpiaReaderScrapePipeline(options?: {
  dryRun?: boolean;
}): Promise<void> {
  const dry = options?.dryRun === true;
  const rootCwd = process.cwd();
  const ymdSeoul = getYmdInTimeZone(new Date(), "Asia/Seoul");
  const lock = await tryAcquireLock("munpia-reader").catch((e) => {
    console.error(`${LOG} [munpia-reader] lock 획득 실패`, e);
    return null;
  });
  if (!lock) {
    console.warn(`${LOG} [munpia-reader] 이미 실행 중(락 존재) — 스킵`);
    return;
  }
  const cookiesPath =
    process.env.PLAYWRIGHT_COOKIES_PATH?.trim() ||
    join(rootCwd, "data", "cookies.json");
  const maxW = munpiaReaderMaxWorksPerRun();

  const supabase = createSupabaseServiceRole();
  const ingested = await fetchMunpiaReaderIngestedNovelKeys(supabase);

  const manualGroups = parseMunpiaReaderWorks();
  let tasks: MunpiaReaderTask[] = [];

  if (manualGroups.length > 0) {
    for (const g of manualGroups.slice(0, maxW)) {
      const key =
        extractNovelKeyFromMunpiaUrl(g.urls[0] ?? "") ??
        (g.detailUrl
          ? extractNovelKeyFromMunpiaUrl(g.detailUrl)
          : null);
      if (!key) {
        console.warn(
          `${LOG} [munpia-reader] 수동 "${g.title}" novel_key 추출 실패 — 스킵`
        );
        continue;
      }
      if (!munpiaReaderIgnoreDuplicates() && ingested.has(key)) {
        console.info(
          `${LOG} [munpia-reader] 이미 인제스트됨 — 스킵 novel_key=${key} (${g.title})`
        );
        continue;
      }
      const detailUrl =
        g.detailUrl?.trim() || `https://m.munpia.com/novel/detail/${key}`;
      tasks.push({
        title: g.title,
        novelKey: key,
        detailUrl,
        manualEpisodeUrls: g.urls,
        munpiaRank: 0,
        isRisingStar: false,
        risingReason: null,
      });
    }
  }

  console.info(
    `${LOG} [munpia-reader] 모드=${manualGroups.length > 0 ? "수동(JSON)" : "자동(베스트)"} max=${maxW} date=${ymdSeoul} cookies=${cookiesPath} dryRun=${dry}`
  );

  const browser = await chromium.launch(
    chromiumLaunchOptions(process.env.HEADLESS !== "0")
  );

  let context: import("playwright").BrowserContext;
  try {
    // 오늘 하드캡: 이미 오늘 목표치만큼 쌓였으면 종료 (중복 강제 모드면 예외)
    if (!dry && !munpiaReaderIgnoreDuplicates()) {
      const { count, error } = await supabase
        .from("trends")
        .select("id", { count: "exact", head: true })
        .eq("platform", "문피아-독자뷰요약")
        .eq("target_date", ymdSeoul);
      if (error) {
        console.warn(`${LOG} [munpia-reader] 오늘 카운트 조회 실패(계속):`, error.message);
      } else if (typeof count === "number" && count >= maxW) {
        console.info(
          `${LOG} [munpia-reader] 오늘 하드캡 도달(${count}/${maxW}) — 종료`
        );
        return;
      }
    }
    context = await newContextWithCookiesJson(browser, cookiesPath, {
      userAgent: CHROME_MAC_RECENT_UA,
    });
  } catch (e) {
    await browser.close();
    throw new Error(
      `쿠키 로드 실패: ${cookiesPath} — npm run cookies:munpia 등으로 생성하거나 PLAYWRIGHT_COOKIES_PATH 를 확인하세요. ${e instanceof Error ? e.message : e}`
    );
  }

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    } catch {
      /* ignore */
    }
  });

  const page = await context.newPage();
  await page.setViewportSize({ width: 1365, height: 900 });

  const chromaHost =
    process.env.CHROMA_SERVER_HOST?.trim() ||
    process.env.CHROMA_HOST?.trim() ||
    DEFAULT_CHROMA_HOST;
  const chromaPortRaw =
    process.env.CHROMA_SERVER_PORT?.trim() || process.env.CHROMA_PORT?.trim();
  const chromaPort = chromaPortRaw
    ? Number.parseInt(chromaPortRaw, 10) || DEFAULT_CHROMA_PORT
    : DEFAULT_CHROMA_PORT;

  try {
    if (manualGroups.length === 0) {
      const bestUrl =
        process.env.MUNPIA_BEST_MOBILE_URL?.trim() ||
        DEFAULT_MUNPIA_BEST_MOBILE_URL;
      await gotoChecked(page, bestUrl, "문피아 베스트 진입");
      await sleep(randomIntInclusive(2200, 3800));
      const rawItems = (await page.evaluate(
        buildMunpiaBestListExtractorExpression()
      )) as MunpiaBestItem[];
      const top40 = (Array.isArray(rawItems) ? rawItems : []).filter(
        (x) =>
          x &&
          typeof x.rank === "number" &&
          x.rank <= 40 &&
          typeof x.novelKey === "string"
      );
      const snap: MunpiaBestSnapshot = {
        savedAt: new Date().toISOString(),
        dateYmd: ymdSeoul,
        sourceUrl: bestUrl,
        items: top40,
      };
      if (!dry) {
        const p = await saveMunpiaBestSnapshot(snap, rootCwd);
        console.info(`${LOG} [munpia-reader] 베스트 스냅샷 저장 ${p}`);
      } else {
        console.info(
          `${LOG} [munpia-reader] --dry-run: 스냅샷 파일 저장 생략 (항목 ${top40.length}개)`
        );
      }

      const yYesterday = getYmdInTimeZone(
        new Date(Date.now() - 86400000),
        "Asia/Seoul"
      );
      const prevSnap = await loadMunpiaBestSnapshot(rootCwd, yYesterday);
      if (!prevSnap) {
        console.warn(
          `${LOG} [munpia-reader] 어제 스냅샷 없음 (${yYesterday}) — new_in_top20 태깅 비활성(급등만 해당 시 동작)`
        );
      }

      const rankFilter = parseMunpiaReaderRankFilter();
      const planCap = rankFilter ? 40 : maxW;
      const ingestedForPlan =
        munpiaReaderIgnoreDuplicates() || (dry && rankFilter)
          ? new Set<string>()
          : ingested;

      const planned = planMunpiaReaderTargets(
        top40,
        prevSnap,
        ingestedForPlan,
        planCap
      );
      let mapped: MunpiaReaderTask[] = planned.map((p) => ({
        title: p.title,
        novelKey: p.novelKey,
        detailUrl: p.detailUrl,
        manualEpisodeUrls: undefined,
        munpiaRank: p.rank,
        isRisingStar: p.isRisingStar,
        risingReason: p.risingReason,
      }));
      if (rankFilter) {
        mapped = mapped.filter((t) => rankFilter.has(t.munpiaRank));
        mapped = mapped.slice(0, maxW);
        if ((dry && rankFilter) || munpiaReaderIgnoreDuplicates()) {
          console.info(
            `${LOG} [munpia-reader] 중복 스킵 무시: IGNORE_DUPLICATE 또는 --dry-run+FILTER_RANKS`
          );
        }
      }
      tasks = mapped;
      console.info(
        `${LOG} [munpia-reader] 자동 선정 ${tasks.length}건:`,
        tasks.map(
          (t) =>
            `${t.title}[#${t.munpiaRank}${t.isRisingStar ? "★rising" : ""}]`
        )
      );
      const deep = tasks.filter((t) => t.isRisingStar || t.munpiaRank <= 3);
      if (deep.length > 0) {
        console.info(
          `${LOG} [munpia-reader] 심층 분석 작전 시작: ${deep[0].title} 외 ${
            deep.length - 1
          }건`
        );
      } else {
        console.info(`${LOG} [munpia-reader] 심층 분석 대상 없음 (전부 1~5화)`);
      }
      await sleep(randomIntInclusive(2800, 4500));
    }

    if (tasks.length === 0) {
      console.warn(
        `${LOG} [munpia-reader] 분석할 작품이 없습니다. 자동: MUNPIA_READER_WORKS_JSON 없이 실행. 수동: JSON·중복·키 추출 확인.`
      );
      return;
    }

    for (let wi = 0; wi < tasks.length; wi++) {
      const task = tasks[wi];
      if (wi > 0) {
        const pauseMs = betweenWorksDelayMs();
        console.info(
          `${LOG} [munpia-reader] 다음 작품까지 ${pauseMs}ms (부하 완화)`
        );
        await sleep(pauseMs);
      }

      const desiredMax = task.isRisingStar || task.munpiaRank <= 3 ? 15 : 5;

      // 확장(15화) 대상인데 기존 5화 분석이 있으면 본문에 추가 분석을 append
      const platform = "문피아-독자뷰요약";
      const dedupId = computeTrendDedupId(
        `${task.title} · 독자뷰 요약 (${ymdSeoul})`,
        platform,
        ymdSeoul
      );

      const { data: existing } = await supabase
        .from("trends")
        .select("id, body, extra")
        .eq("dedup_id", dedupId)
        .maybeSingle();

      const existingExtra =
        (existing?.extra as Record<string, unknown> | null) ?? null;
      const existingMax =
        typeof existingExtra?.episodes_analyzed_max === "number"
          ? (existingExtra.episodes_analyzed_max as number)
          : typeof existingExtra?.episode_urls === "number"
            ? (existingExtra.episode_urls as number)
            : 0;

      let raw: string;
      try {
        if (desiredMax === 15 && existingMax >= 5 && existingMax < 15) {
          // 요구사항: 10~15화 추가 분석만 붙이기 (기존 1~5화 유지)
          const extraStart = 10;
          const extraEnd = 15;
          const extraUrls = await munpiaReaderDiscoverEpisodeUrls(
            page,
            task.novelKey,
            extraEnd
          );
          const slice = extraUrls.slice(extraStart - 1, extraEnd); // 10..15
          raw = await scrapeMunpiaWorkEpisodesHumanLike(
            page,
            slice,
            `${task.title} (10~15화)`,
            { tocUrl: buildNovelTocUrl(task.novelKey), exitToTocEvery: 3 }
          );
        } else {
          raw = await scrapeMunpiaFullWorkReaderPath(page, {
            title: task.title,
            novelKey: task.novelKey,
            detailUrl: task.detailUrl,
            manualEpisodeUrls: task.manualEpisodeUrls,
            desiredMaxEpisodeNo: desiredMax,
            exitToTocEvery: desiredMax === 15 ? 3 : 0,
          });
        }
      } catch (e) {
        console.error(`${LOG} [munpia-reader] "${task.title}" 수집 실패`, e);
        const msg = e instanceof Error ? e.message : String(e);
        if (/HTTP (403|429|5\\d\\d)/.test(msg)) {
          const backoff = munpiaBackoffMs();
          console.warn(
            `${LOG} [munpia-reader] 차단/과부하 신호 감지 → ${backoff}ms 백오프 후 종료`
          );
          await sleep(backoff);
          return;
        }
        continue;
      }

      const readerMeta = {
        isRisingStar: task.isRisingStar,
        risingReason: task.risingReason,
        munpiaRank: task.munpiaRank,
      };
      const analysisMd = await buildMunpiaReaderMarkdownWithClaude(
        raw,
        task.title,
        ymdSeoul,
        readerMeta
      );

      let fullMd = wrapMunpiaReaderSavedMarkdown(task.title, ymdSeoul, analysisMd, {
        munpiaNovelKey: task.novelKey,
        munpiaRank: task.munpiaRank,
        isRisingStar: task.isRisingStar,
        risingReason: task.risingReason,
      });

      // append 모드: 기존 본문을 유지하고 "추가 분석(10~15화)"를 덧붙임
      if (desiredMax === 15 && existing?.body && existingMax >= 5 && existingMax < 15) {
        const appended = `\n\n---\n\n## 추가 분석 (10~15화)\n\n${analysisMd}\n`;
        fullMd = `${String(existing.body).trim()}\n${appended}`.trim();
      }
      const fileName = `munpia-reader-${slugForMunpiaReaderFile(task.title)}-${ymdSeoul}.md`;
      const filePath = join(TRENDS_DIR, fileName);

      const epCount = desiredMax === 15 ? 15 : 5;

      if (dry) {
        console.info(
          `${LOG} [munpia-reader] --dry-run "${task.title}"\n${fullMd.slice(0, 2800)}…`
        );
        continue;
      }

      await mkdir(TRENDS_DIR, { recursive: true });
      await writeFile(filePath, fullMd, "utf8");
      console.info(`${LOG} [munpia-reader] 저장: ${filePath}`);

      const ingest = await withRetry(
        `ingestData munpia-reader "${task.title}"`,
        () =>
          ingestData(
            {
              title: `${task.title} · 독자뷰 요약 (${ymdSeoul})`,
              body: fullMd,
              genre: "전체",
              platform,
              targetDate: ymdSeoul,
              trendDate: ymdSeoul,
              citationSource: `문피아 뷰어(쿠키)·인간 패턴 수집; Chroma ${chromaHost}:${chromaPort}`,
              extra: {
                pipeline: "automate_trends_munpia_reader",
                work_title: task.title,
                munpia_novel_key: task.novelKey,
                munpia_rank: task.munpiaRank,
                is_rising_star: task.isRisingStar,
                rising_reason: task.risingReason,
                episode_urls: epCount,
                episodes_analyzed_max: epCount,
              },
            },
            { chroma: { host: chromaHost, port: chromaPort } }
          ),
        { maxAttempts: 2, baseDelayMs: 3000 }
      );
      console.info(
        `${LOG} [munpia-reader] ingest 완료 trendId=${ingest.trendId} chunks=${ingest.chromaChunks}`
      );
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await releaseLock(lock);
  }

  console.info(`${LOG} [munpia-reader] 파이프라인 종료`);
}

export async function runDailyTrendPipeline(options?: {
  dryRun?: boolean;
}): Promise<void> {
  const lock = await tryAcquireLock("daily-trends").catch((e) => {
    console.error(`${LOG} [daily] lock 획득 실패`, e);
    return null;
  });
  if (!lock) {
    console.warn(`${LOG} [daily] 이미 실행 중(락 존재) — 스킵`);
    return;
  }
  try {
    const dry = options?.dryRun === true;
    const serperKey = process.env.SERPER_API_KEY?.trim();
    if (!serperKey) {
      throw new Error("SERPER_API_KEY 가 필요합니다.");
    }

  const targetDateYmd = new Date().toISOString().slice(0, 10);

  console.info(`${LOG} 시작 targetDate=${targetDateYmd} dryRun=${dry}`);

  let serperBlock = "";
  try {
    serperBlock = await fetchSerperWebTrends(serperKey);
  } catch (e) {
    console.error(`${LOG} Serper 전체 실패, 빈 블록으로 진행`, e);
    serperBlock = "(Serper 호출 실패)";
  }

  const { munpia, kakao, naverSeries } = await collectRankings();
  console.info(
    `${LOG} 랭킹 수집: 문피아 ${munpia.length}건, 카카오 ${kakao.length}건, 네이버시리즈 ${naverSeries.length}건`
  );

  const markdown = await buildMarkdownWithClaude({
    serperBlock,
    munpia,
    kakao,
    naverSeries,
    targetDateYmd,
  });

  if (dry) {
    console.info(`${LOG} --dry-run: 저장·인제스트 생략\n---\n${markdown.slice(0, 2000)}…`);
    return;
  }

  await saveTrendFile(targetDateYmd, markdown);

  const chromaHost =
    process.env.CHROMA_SERVER_HOST?.trim() ||
    process.env.CHROMA_HOST?.trim() ||
    DEFAULT_CHROMA_HOST;
  const chromaPortRaw =
    process.env.CHROMA_SERVER_PORT?.trim() || process.env.CHROMA_PORT?.trim();
  const chromaPort = chromaPortRaw
    ? Number.parseInt(chromaPortRaw, 10) || DEFAULT_CHROMA_PORT
    : DEFAULT_CHROMA_PORT;

  const title = `데일리 트렌드 분석 ${targetDateYmd}`;

  const ingest = await withRetry(
    "ingestData (Supabase + Chroma)",
    () =>
      ingestData(
        {
          title,
          body: markdown,
          genre: "전체",
          platform: "자동수집",
          targetDate: targetDateYmd,
          trendDate: targetDateYmd,
          citationSource: `Serper+문피아+카카오+네이버시리즈 자동수집; Chroma ${chromaHost}:${chromaPort}`,
          extra: {
            pipeline: "automate_trends",
            serper_queries: 3,
            munpia_titles: munpia.length,
            kakao_titles: kakao.length,
            naver_series_titles: naverSeries.length,
            summary_hint:
              "급상승 키워드·랭킹 요약·종합 인사이트는 본문 마크다운 참고",
          },
        },
        {
          chroma: { host: chromaHost, port: chromaPort },
        }
      ),
    { maxAttempts: 2, baseDelayMs: 3000 }
  );

  console.info(
    `${LOG} 이중 인제스트 완료 trendId=${ingest.trendId} chunks=${ingest.chromaChunks}`
  );

  await insertTrendReportLegacy({
    title: "데일리 트렌드 분석 리포트",
    body: markdown,
    reportDateYmd: targetDateYmd,
    extra: {
      pipeline: "automate_trends",
      trend_id: ingest.trendId,
      dedup_id: ingest.dedupId,
      chroma_chunks: ingest.chromaChunks,
      munpia_titles: munpia.length,
      kakao_titles: kakao.length,
      naver_series_titles: naverSeries.length,
    },
  });

    console.info(`${LOG} 파이프라인 정상 종료`);

  // 후속 작업(문피아 심층 등) 순서 보장용 — EC2 system cron처럼 `--cron` 없이 데일리만 돌려도 마커 기록
    await writeDailyDoneMarker(targetDateYmd).catch(() => {});
  } finally {
    await releaseLock(lock);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cronMode = argv.includes("--cron");
  const dryRun = argv.includes("--dry-run");
  const munpiaScrape = argv.includes("--munpia-scrape");

  if (munpiaScrape) {
    runMunpiaReaderScrapePipeline({ dryRun })
      .then(() => process.exit(0))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
    return;
  }

  if (cronMode) {
    console.info(
      `${LOG} cron 등록: 데일리(04:00) + 문피아 심층(04:10) Asia/Seoul`
    );
    nodeCron.schedule(
      "0 4 * * *",
      () => {
        runDailyTrendPipeline({ dryRun: false }).catch((e) => {
          console.error(`${LOG} cron 실행 실패`, e);
        });
      },
      { timezone: "Asia/Seoul" }
    );
    nodeCron.schedule(
      // 데일리 이후, 문피아 심층 실행 전 (04:05)
      "5 4 * * *",
      () => {
        refreshCoinStatsForTodayUtc().catch((e) => {
          console.error(`${LOG} [coin-stats] cron 실행 실패`, e);
        });
      },
      { timezone: "Asia/Seoul" }
    );
    nodeCron.schedule(
      "10 4 * * *",
      async () => {
        const ymd = getYmdInTimeZone(new Date(), "Asia/Seoul");
        const ok = await waitForDailyDoneMarker(ymd, {
          // 04:10~06:00 윈도우 안에서만 대기
          timeoutMs: 110 * 60_000,
          pollMs: 10_000,
        }).catch(() => false);
        if (!ok) {
          console.warn(
            `${LOG} [munpia-reader] 데일리 마커 대기 타임아웃 — 그래도 실행 계속`
          );
        }
        // 04:10~06:00 랜덤 시작(순서 보장: 데일리 마커 대기 후)
        const base = nextCronTimeTodaySeoul(4, 10).getTime();
        const deadline = nextCronTimeTodaySeoul(6, 0).getTime();
        const delay = randomMunpiaStartDelayMs();
        const scheduled = base + delay;
        const now = Date.now();
        const target = Math.max(now, scheduled);
        if (target > deadline) {
          console.warn(
            `${LOG} [munpia-reader] 랜덤 시작 시간이 06:00을 초과 — 오늘 실행 스킵`
          );
          return;
        }
        const waitMs = Math.max(0, target - now);
        if (waitMs > 0) {
          console.info(
            `${LOG} [munpia-reader] 랜덤 시작까지 대기 ${waitMs}ms (윈도우 04:10~06:00)`
          );
          await sleep(waitMs);
        }
        await runMunpiaReaderScrapePipeline({ dryRun: false }).catch((e) => {
          console.error(`${LOG} munpia cron 실행 실패`, e);
        });
      },
      { timezone: "Asia/Seoul" }
    );
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
    return;
  }

  runDailyTrendPipeline({ dryRun })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

main();
