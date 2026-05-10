import { expect, test } from '@playwright/test';

/**
 * /dev/atoms-preview 페이지 visual baseline — guard.
 *
 * guard baseline = 디자인 시스템 (atoms) 회귀 검출. 의도치 않은 변경 시 PR 차단.
 * 변경 발생 시 LEE 명시 승인 후 baseline 갱신. ADR-0025 참조.
 *
 * 검증 대상:
 * - Button (variant × size × disabled) — ADR-0024
 * - Input (기본/error/disabled) — ADR-0024
 * - Card + 서브컴포넌트 — ADR-0024
 * - Badge (variant × size) — ADR-0024 갱신
 * - Modal trigger 버튼 (닫힌 상태)
 *
 * /dev/* proxy guard: production 만 차단, e2e dev 환경 = NODE_ENV=development → 자동 통과.
 *
 * Modal 열린 상태 baseline 은 페이즈 5 (분석 모달) 시점 별도 spec 으로 박음.
 *
 * mask:
 * - Next.js dev indicator (nextjs-portal / [data-next-mark]) — dev mode 만 박힘. mask.
 * - FloatingInquiryButton — Novel Agent 자체 컴포넌트 → baseline 박음 (mask 안 박음).
 */
test.describe('Visual baseline (guard) — atoms-preview', () => {
  test('/dev/atoms-preview Modal 닫힌 상태 visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/atoms-preview');
    await page.getByRole('heading', { name: 'atoms preview (페이즈 1)' }).waitFor();
    await page.getByRole('button', { name: 'Modal 열기' }).waitFor();

    await expect(page).toHaveScreenshot('atoms-preview.png', {
      fullPage: true,
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
      ],
    });
  });
});
