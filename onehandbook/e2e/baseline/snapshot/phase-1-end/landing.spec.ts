import { expect, test } from '@playwright/test';

/**
 * 비로그인 랜딩 ('/') 의 visual baseline — snapshot (phase-1-end).
 *
 * snapshot baseline = 페이즈별 의도된 디자인 박제. 페이즈 2 진입 시 의도된 변경 발생 →
 * LEE 명시 승인 후 baseline 갱신. ADR-0025 참조.
 *
 * 안정화 정책:
 * - GenreScoreCounter — 1.5s 카운팅. emulateMedia({ reducedMotion: 'reduce' }) 로 즉시 target 박힘.
 * - LandingHeroCoverSliders — cover 마퀴 CSS animation. toHaveScreenshot 의
 *   animations: 'disabled' (config 기본값) 으로 infinite animation cancel → 시작 frame 박힘.
 * - cover 이미지 lazy-load — networkidle 대기로 박힘 시점 통일.
 *
 * mask:
 * - Next.js dev indicator (nextjs-portal / [data-next-mark]) — dev mode 만 박힘. production
 *   에 없음 → baseline 검증 가치 0. 영역 mask 박음.
 * - FloatingInquiryButton — Novel Agent 자체 컴포넌트 → baseline 박음 (mask 안 박음).
 *   랜딩에는 시각적으로 안 박힌 듯 (LEE 시각 확인 결과).
 */
test.describe('Visual baseline (snapshot, phase-1-end) — landing', () => {
  test('비로그인 / 페이지 visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /당신의 원고/ }).waitFor();
    await page.getByRole('link', { name: '지금 시작하기' }).waitFor();

    await expect(page).toHaveScreenshot('landing.png', {
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
      ],
    });
  });
});
