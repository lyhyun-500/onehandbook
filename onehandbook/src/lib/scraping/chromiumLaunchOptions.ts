import { chromium, type LaunchOptions } from "playwright";

/**
 * Playwright 1.50+ 는 headless 기본이 chromium-headless-shell(별도 ZIP)입니다.
 * EC2에서 그 바이너리만 없거나 다운로드 실패 시 launch가 바로 죽는 경우가 많아,
 * Linux에서는 기본으로 **풀 Chromium**(`npx playwright install chromium`)으로 headless 실행합니다.
 *
 * - 강제로 headless shell 쓰려면: `PLAYWRIGHT_USE_HEADLESS_SHELL=1`
 * - Linux가 아닌데 풀 Chromium 쓰려면: `PLAYWRIGHT_USE_FULL_CHROMIUM=1`
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

  const wantHeadlessShell =
    process.env.PLAYWRIGHT_USE_HEADLESS_SHELL?.trim() === "1";
  const forceFull =
    process.env.PLAYWRIGHT_USE_FULL_CHROMIUM?.trim() === "1";
  const linuxDefaultFull =
    process.platform === "linux" && headless && !wantHeadlessShell;

  if (headless && (forceFull || linuxDefaultFull)) {
    opts.executablePath = chromium.executablePath();
  }
  return opts;
}
