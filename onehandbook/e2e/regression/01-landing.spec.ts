import { expect, test } from '@playwright/test';

test.describe('Landing — unauthenticated', () => {
  test('루트 페이지 200 + hero heading + CTA 노출', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: /에이전트가 먼저 읽습니다/ })).toBeVisible();
    await expect(page.getByRole('link', { name: '가입하고 20 NAT 받기' }).first()).toBeVisible();
    // 헤더의 "로그인" 링크는 페이지 다른 곳에도 같은 텍스트가 있을 수 있어 first()로 한정
    await expect(page.getByRole('link', { name: '로그인' }).first()).toBeVisible();
  });

  test('"가입하고 20 NAT 받기" 클릭 → /login 진입', async ({ page }) => {
    await page.goto('/');
    // Next.js Link 클릭과 nav 사이 dev 모드 race 방지 — waitForURL 리스너를 click 이전에 부착.
    // Hero CTA + 하단 CTA 모두 같은 카피를 쓰므로 first() 로 한정.
    await Promise.all([
      page.waitForURL(/\/login/),
      page.getByRole('link', { name: '가입하고 20 NAT 받기' }).first().click(),
    ]);
  });
});
