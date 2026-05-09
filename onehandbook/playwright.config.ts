import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Playwright doesn't auto-load .env.local; fixtures need E2E_* vars at runtime.
loadEnv({ path: '.env.local' });

const REQUIRED_ENV = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_SUPABASE_SERVICE_ROLE_KEY',
  'E2E_TEST_WRITER_EMAIL',
  'E2E_TEST_ADMIN_EMAIL',
] as const;

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(
    `Missing required env vars in .env.local: ${missing.join(', ')}.\n` +
      'See .env.local.example for the E2E block.',
  );
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

// Filter undefined entries so Playwright's Record<string, string> typing is satisfied.
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => typeof v === 'string'),
) as Record<string, string>;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  globalSetup: './e2e/global-setup.ts',
  globalTimeout: 5 * 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // dev 모드 동시 부하로 spec 04 test 3 ECONNRESET 가 1 회 관찰됨 → 로컬도 retry: 1.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // To extend: copy the block above and swap devices preset.
    // { name: 'firefox',     use: { ...devices['Desktop Firefox'] } },
    // { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...inheritedEnv,
      // Override the dev server's Supabase target to the E2E project so that
      // fixture-issued E2E session cookies validate against the same project.
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
      NEXT_PUBLIC_SITE_URL: baseURL,
      // /api/analyze 의 isProviderConfigured 검증을 통과시키되, 실제 Anthropic API 호출은
      // 가짜 키 → 401 fail 로 끝나도록. e2e 가 검증하는 건 jobs INSERT + NAT 차감 (background
      // worker 의 LLM 호출 결과는 비범위). 실 키가 노출되거나 비용이 발생할 위험 0.
      ANTHROPIC_API_KEY: 'sk-ant-e2e-fake-not-real',
    },
  },
});
