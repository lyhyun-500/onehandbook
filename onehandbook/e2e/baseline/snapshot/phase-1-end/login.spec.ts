import { expect, test } from '@playwright/test';

/**
 * /login 단독 페이지 visual baseline — snapshot (phase-1-end).
 *
 * 현 시점 /login 은 모달이 아닌 단독 페이지 (LoginPageClient 박힘).
 * 페이지 2 에서 모달 전환 도입 시 본 spec 갱신 또는 login-modal.spec.ts 로 대체.
 * snapshot baseline 갱신 정책 — ADR-0025 (LEE 게이트).
 *
 * dynamic 영역:
 * - 없음. error 메시지는 ?error=... query param 박힐 때만 박힘 → /login 단순 진입 시 안 박힘.
 * - loading state 는 OAuth 버튼 클릭 후 박힘 → baseline 시 클릭 안 함.
 *
 * mask:
 * - Next.js dev indicator (nextjs-portal / [data-next-mark]) — dev mode 만 박힘. mask.
 * - FloatingInquiryButton — Novel Agent 자체 컴포넌트 → baseline 박음 (mask 안 박음).
 */
test.describe('Visual baseline (snapshot, phase-1-end) — login', () => {
  test('비로그인 /login 단독 페이지 visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    await page.getByRole('button', { name: /Google/i }).waitFor();

    await expect(page).toHaveScreenshot('login.png', {
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
      ],
    });
  });
});
