/**
 * 문피아 웹 로그인 후 Playwright storageState(JSON)를 저장합니다.
 * `ingest_free_episode_summaries.ts` 등이 읽는 형식과 동일합니다.
 *
 * 1) .env.local 에 MUNPIA_LOGIN_ID, MUNPIA_LOGIN_PASSWORD 설정 (커밋 금지)
 * 2) npx playwright install chromium (최초 1회)
 * 3) npm run cookies:munpia
 *
 * 출력: 기본 data/cookies.json (PLAYWRIGHT_COOKIES_PATH 로 덮어쓰기 가능)
 * 캡차·2단계가 뜨면 HEADLESS=0 npm run cookies:munpia 로 브라우저를 띄워 수동 처리하세요.
 *
 * 참고: www.munpia.com 메인은 로그인 모듈을 AJAX로 늦게 붙여서 "로그인" 링크를 못 찾는 경우가 많습니다.
 * 기본은 통합 로그인 호스트 nssl.munpia.com 으로 바로 이동합니다.
 */

import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: ".env.local" });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_LOGIN_URL =
  "https://nssl.munpia.com/login?redirectUrl=https%3A%2F%2Fwww.munpia.com%2F";

async function main() {
  const id = process.env.MUNPIA_LOGIN_ID?.trim();
  const password = process.env.MUNPIA_LOGIN_PASSWORD?.trim();
  const outPath =
    process.env.PLAYWRIGHT_COOKIES_PATH?.trim() ||
    join(process.cwd(), "data", "cookies.json");

  if (!id || !password) {
    console.error(
      "[cookies:munpia] MUNPIA_LOGIN_ID, MUNPIA_LOGIN_PASSWORD 를 .env.local 에 설정하세요."
    );
    process.exit(1);
  }

  const headless = process.env.HEADLESS !== "0";
  const loginUrl =
    process.env.MUNPIA_LOGIN_PAGE_URL?.trim() || DEFAULT_LOGIN_URL;

  await mkdir(dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ userAgent: UA });
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // nssl 폼: placeholder 기반 라벨, 제출 버튼은 입력 전 disabled
    const userField = page.locator("#username").or(page.getByPlaceholder("아이디"));
    const passField = page.locator("#password").or(page.getByPlaceholder("비밀번호"));
    await userField.waitFor({ state: "visible", timeout: 20_000 });
    await userField.fill(id);
    await passField.fill(password);

    const submit = page.locator("#submitButton");
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector(
            "#submitButton"
          ) as HTMLButtonElement | null;
          return el != null && !el.disabled;
        },
        { timeout: 15_000 }
      )
      .catch(() => {});
    await submit.click();

    await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});

    const later = page.getByRole("button", { name: "다음에 변경하기" });
    if (await later.isVisible({ timeout: 5000 }).catch(() => false)) {
      await later.click();
    }

    await context.storageState({ path: outPath });
    console.info(`[cookies:munpia] 저장 완료: ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(
    "[cookies:munpia] 실패:",
    e instanceof Error ? e.message : e
  );
  process.exit(1);
});
