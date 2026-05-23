import { expect, test } from '@playwright/test';

/**
 * 비로그인 랜딩 ('/') 의 visual baseline — snapshot (phase-2-end).
 *
 * Phase 2-B 디자인 마이그레이션 완료 상태 박제. ADR-0025 의 snapshot 정책 적용.
 * Phase 1 baseline (snapshot/phase-1-end/landing.spec.ts) 와 동일 구조.
 *
 * mask 정책:
 * - Next.js dev indicator (production 부재) — phase-1-end 정책 그대로.
 * - #sample (LiveScoreCard 영역) — RAF + setInterval 기반 점수/막대 동적 렌더.
 *   reducedMotion 미차단 → mask 처리. ADR-0027 의 stone-400 위계 검증과는 별개
 *   (LiveScoreCard 자체 시각 회귀는 dev/landing-preview 페이지로 검증).
 *
 * Phase 2-B 마이그레이션 항목 (page.tsx 풀 마이그레이션 + footer 통일):
 * - 헤더 logo + nav + 로그인 + CTA "무료로 시작"
 * - Hero (좌측 헤드라인 + Hero stats + 우측 LiveScoreCard)
 * - Features 3 블록
 * - How it works 4 단계
 * - CTA 섹션 ("가입하고 20 NAT 받기")
 * - Footer = SiteFooter (사이트 전역 통일, ADR-0024 빈틈 사례 #2 적용)
 */
test.describe('Visual baseline (snapshot, phase-2-end) — landing', () => {
  test('비로그인 / 페이지 visual baseline', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /에이전트가 먼저 읽습니다/ }).waitFor();
    await page.getByRole('button', { name: '가입하고 20 NAT 받기' }).first().waitFor();

    await expect(page).toHaveScreenshot('landing.png', {
      mask: [
        page.locator('[data-next-mark]'),
        page.locator('[data-nextjs-toast]'),
        page.locator('#sample'),
      ],
      fullPage: true,
    });
  });
});
