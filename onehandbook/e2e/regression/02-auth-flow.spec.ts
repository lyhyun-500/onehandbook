import { test, expect } from '../fixtures/test-user';

test.describe('Auth flow — writer session', () => {
  test('인증 후 /studio 진입 + NAT 잔량 노출', async ({ writer }) => {
    // 정확한 NAT 값(30)은 spec 04 의 NAT=0 race 와 충돌해 \d+ 로 일반화.
    await writer.page.goto('/studio');
    await expect(writer.page).toHaveURL(/\/studio/);
    await expect(writer.page.getByText(/\d+\s*NAT/)).toBeVisible();
  });

  test('메뉴 열기 → 로그아웃 버튼 노출', async ({ writer }) => {
    await writer.page.goto('/studio');
    await writer.page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(writer.page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });
});
