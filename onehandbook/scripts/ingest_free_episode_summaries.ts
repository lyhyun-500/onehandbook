/**
 * 무료 회차(1~5화 등) 뷰어 본문 → LLM 요약(문체 / 전개 방식 / 핵심 소재) → Supabase trends + Chroma
 *
 * - `data/cookies.json`(또는 PLAYWRIGHT_COOKIES_PATH): 로그인 세션 (Playwright storageState 권장)
 * - URL은 .env에 쉼표로 나열 (문피아·카카오 각각 최대 5~10개)
 * - 회차 간 3~5초 랜덤 지연 (FREE_EPISODE_DELAY_MS_MIN/MAX 로 조절)
 * - DB·Chroma에는 **요약 마크다운만** 넣음 (원문 전체 미저장)
 *
 * 실행: npx tsx scripts/ingest_free_episode_summaries.ts
 *       npx tsx scripts/ingest_free_episode_summaries.ts --dry-run
 */

import { join } from "path";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { chromiumLaunchOptions } from "@/lib/scraping/chromiumLaunchOptions";
import { ANALYSIS_CLAUDE_MODEL } from "@/config/analysis-profiles";
import { completeAnthropic } from "@/lib/ai/providers/anthropic";
import { ingestData } from "@/lib/trends/ingestData";
import { newContextWithCookiesJson } from "@/lib/scraping/playwrightCookies";
import { extractEpisodeMainText } from "@/lib/scraping/freeEpisodeExtract";

dotenv.config({ path: ".env.local" });

const LOG = "[free-episodes]";

function parseUrlList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function humanDelayMs(): number {
  const min = Number(process.env.FREE_EPISODE_DELAY_MS_MIN ?? 3000);
  const max = Number(process.env.FREE_EPISODE_DELAY_MS_MAX ?? 5000);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function scrapeUrlsInOrder(
  context: import("playwright").BrowserContext,
  urls: string[],
  label: string
): Promise<string> {
  const parts: string[] = [];
  const page = await context.newPage();
  try {
    for (let i = 0; i < urls.length; i++) {
      if (i > 0) {
        const d = humanDelayMs();
        console.info(`${LOG} ${label} 회차 간 대기 ${d}ms`);
        await sleep(d);
      }
      console.info(`${LOG} ${label} ${i + 1}/${urls.length} 로딩`);
      await page.goto(urls[i], {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      // 페이지 렌더·로그인 후 본문 로드 대기 (waitForTimeout 대체)
      await sleep(humanDelayMs());
      const text = await extractEpisodeMainText(page, {
        selectorsEnv: process.env.FREE_EPISODE_CONTENT_SELECTORS,
      });
      parts.push(`### [${label} ${i + 1}화 구간]\n${text}`);
    }
  } finally {
    await page.close();
  }
  return parts.join("\n\n---\n\n");
}

async function summarizeForIngest(
  raw: string,
  platformLabel: string
): Promise<string> {
  const capped = raw.slice(0, 48000);
  const system = `당신은 웹소설 편집 보조입니다. 뷰어에서 추출한 텍스트에 없는 사실을 지어내지 마세요.`;
  const user = `플랫폼: ${platformLabel}

아래는 동일 작품의 무료 공개 구간(여러 회)에서 가져온 텍스트입니다.
원문 전체를 저장하지 않고 RAG용으로 쓸 **짧은 요약**만 작성하세요.

반드시 아래 마크다운 구조만 사용합니다 (각 섹션 2~10문장, 전체 합쳐 2000자 이내).

### 문체
### 전개 방식
### 핵심 소재

---
원문:
${capped}`;

  return completeAnthropic({
    model: ANALYSIS_CLAUDE_MODEL,
    system,
    user,
  });
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry-run");
  const cookiesPath =
    process.env.PLAYWRIGHT_COOKIES_PATH?.trim() ||
    join(process.cwd(), "data", "cookies.json");

  const munpiaUrls = parseUrlList(process.env.FREE_EPISODE_MUNPIA_URLS);
  const kakaoUrls = parseUrlList(process.env.FREE_EPISODE_KAKAO_URLS);

  if (munpiaUrls.length === 0 && kakaoUrls.length === 0) {
    throw new Error(
      "FREE_EPISODE_MUNPIA_URLS 또는 FREE_EPISODE_KAKAO_URLS 에 쉼표로 구분한 회차 URL을 설정하세요."
    );
  }

  const browser = await chromium.launch(chromiumLaunchOptions(true));

  let context: import("playwright").BrowserContext;
  try {
    context = await newContextWithCookiesJson(browser, cookiesPath);
  } catch (e) {
    await browser.close();
    throw new Error(
      `${cookiesPath} 로드 실패. Playwright로 내보낸 cookies.json 경로를 PLAYWRIGHT_COOKIES_PATH 로 지정하세요. (${e instanceof Error ? e.message : e})`
    );
  }

  const ymd = new Date().toISOString().slice(0, 10);
  const chromaHost =
    process.env.CHROMA_SERVER_HOST?.trim() ||
    process.env.CHROMA_HOST?.trim() ||
    "54.252.238.168";
  const chromaPortRaw =
    process.env.CHROMA_SERVER_PORT?.trim() || process.env.CHROMA_PORT?.trim();
  const chromaPort = chromaPortRaw
    ? Number.parseInt(chromaPortRaw, 10) || 8000
    : 8000;

  try {
    if (munpiaUrls.length > 0) {
      const raw = await scrapeUrlsInOrder(context, munpiaUrls, "문피아");
      const title =
        process.env.FREE_EPISODE_MUNPIA_TITLE?.trim() || "문피아 무료회차 요약";
      const summaryMd = await summarizeForIngest(raw, "문피아");
      if (dry) {
        console.info(`${LOG} --dry-run 문피아 요약 미리보기:\n`, summaryMd.slice(0, 2500));
      } else {
        await ingestData(
          {
            title: `${title} (${ymd})`,
            body: summaryMd.trim(),
            genre: "전체",
            platform: "문피아-무료회차요약",
            targetDate: ymd,
            trendDate: ymd,
            citationSource: "문피아 무료구간 뷰어 추출 → Claude 요약",
            extra: {
              kind: "free_episode_summary_ingest",
              episode_urls_count: munpiaUrls.length,
              cookies_file: cookiesPath,
            },
          },
          { chroma: { host: chromaHost, port: chromaPort } }
        );
        console.info(`${LOG} 문피아 요약 인제스트 완료`);
      }
    }

    if (kakaoUrls.length > 0) {
      const raw = await scrapeUrlsInOrder(context, kakaoUrls, "카카오페이지");
      const title =
        process.env.FREE_EPISODE_KAKAO_TITLE?.trim() || "카카오 무료회차 요약";
      const summaryMd = await summarizeForIngest(raw, "카카오페이지");
      if (dry) {
        console.info(`${LOG} --dry-run 카카오 요약 미리보기:\n`, summaryMd.slice(0, 2500));
      } else {
        await ingestData(
          {
            title: `${title} (${ymd})`,
            body: summaryMd.trim(),
            genre: "전체",
            platform: "카카오-무료회차요약",
            targetDate: ymd,
            trendDate: ymd,
            citationSource: "카카오페이지 무료구간 뷰어 추출 → Claude 요약",
            extra: {
              kind: "free_episode_summary_ingest",
              episode_urls_count: kakaoUrls.length,
              cookies_file: cookiesPath,
            },
          },
          { chroma: { host: chromaHost, port: chromaPort } }
        );
        console.info(`${LOG} 카카오 요약 인제스트 완료`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.info(`${LOG} 종료`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
