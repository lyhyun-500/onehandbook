import { chromium, type LaunchOptions } from "playwright";

/**
 * Playwright 1.50+ 는 headless 기본이 chromium-headless-shell(별도 다운로드)입니다.
 * EC2 등에서 해당 바이너리 ZIP 다운로드가 실패하면 `.env`에
 * PLAYWRIGHT_USE_FULL_CHROMIUM=1 을 두어 이미 설치된 풀 Chromium으로 headless 실행합니다.
 */
export function chromiumLaunchOptions(
  headless: boolean,
  extra?: Partial<LaunchOptions>
): LaunchOptions {
  const opts: LaunchOptions = {
    headless,
    // EC2/리눅스: /dev/shm 기본 64MB 등에서 Chromium이 바로 죽는 경우 방지
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    ...extra,
  };
  if (
    headless &&
    process.env.PLAYWRIGHT_USE_FULL_CHROMIUM?.trim() === "1"
  ) {
    opts.executablePath = chromium.executablePath();
  }
  return opts;
}
