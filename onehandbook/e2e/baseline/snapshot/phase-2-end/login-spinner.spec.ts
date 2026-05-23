import { expect, test } from '@playwright/test';

/**
 * LoginSpinner (auth stage) visual baseline — snapshot (phase-2-end).
 *
 * /auth/callback 박힌 실 흐름 = useEffect 박은 즉시 window.location.replace
 * → baseline 박는 시점 redirect 박혀 LoginSpinner frame 박지 못함 (race).
 * 회귀 안전망 박음 위해 dev preview (/dev/login-spinner-preview) 박은
 * LoginSpinner 단독 baseline 박음. ADR-0025 의 snapshot 정책 박은 미세 변형.
 *
 * mask 정책:
 * - Next.js dev indicator (production 부재).
 * - LoginSpinner 의 RAF spinner (data-testid="login-spinner-circle") — na-spin animation.
 * - role="progressbar" (3-stage indicator) — 현재 stage 박힌 na-pulse animation.
 * - dev preview 의 stage 토글 박음 (top-6 right-6 fixed) — preview 인프라.
 */
test.describe('Visual baseline (snapshot, phase-2-end) — login-spinner', () => {
  test('LoginSpinner auth stage visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/login-spinner-preview', { waitUntil: 'networkidle' });
    await page.getByText('인증 정보 확인 중').waitFor();

    await expect(page).toHaveScreenshot('login-spinner.png', {
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
        page.locator('[data-testid="login-spinner-circle"]'),
        page.locator('[role="progressbar"]'),
        page.locator('div.fixed.top-6.right-6'),
      ],
    });
  });
});
