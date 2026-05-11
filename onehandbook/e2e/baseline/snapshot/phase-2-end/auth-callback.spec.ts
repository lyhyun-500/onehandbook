import { expect, test } from '@playwright/test';

/**
 * /auth/callback (에러 화면) visual baseline — snapshot (phase-2-end).
 *
 * 정상 흐름 = code param 박은 채 접속 → 즉시 redirect (LoginSpinner 박힌 frame
 * baseline 박지 못함). 본 spec 박음 영역 = code 부재 박힌 에러 흐름:
 * - svg 로고 + 에러 메시지 카드 + "홈으로 돌아가기" Link
 * - LoginSpinner 회귀 안전망 = login-spinner.spec.ts 박음.
 *
 * mask 정책:
 * - Next.js dev indicator (production 부재).
 */
test.describe('Visual baseline (snapshot, phase-2-end) — auth-callback', () => {
  test('/auth/callback 에러 화면 visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/auth/callback', { waitUntil: 'networkidle' });
    await page.getByText('로그인 코드가 없습니다').waitFor();

    await expect(page).toHaveScreenshot('auth-callback.png', {
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
      ],
    });
  });
});
