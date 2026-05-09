import { test, expect } from '../fixtures/test-user';

test.describe('NAT balance & 충전 진입', () => {
  test('헤더에 NAT 잔량 표시', async ({ writer }) => {
    // spec 04 의 INSUFFICIENT_NAT 테스트가 짧게 coin_balance=0 으로 조정해 30 정확값 race.
    // 본 테스트의 의도는 "헤더에 NAT 표시가 노출된다" 이므로 숫자 자릿수만 검증.
    await writer.page.goto('/studio');
    await expect(writer.page.getByText(/\d+\s*NAT/)).toBeVisible();
  });

  test('메뉴 → "NAT 충전" 링크 노출 + href=/billing', async ({ writer }) => {
    await writer.page.goto('/studio');
    await writer.page.getByRole('button', { name: '메뉴 열기' }).click();
    const natChargeLink = writer.page.getByRole('link', { name: 'NAT 충전' });
    await natChargeLink.waitFor({ state: 'visible' });
    // 실제 click → 네비게이션 검증은 dev 모드에서 menu unmount race가 발생해 불안정.
    // 다음 test('/billing 직접 접근')가 동일한 도착 페이지를 검증하므로,
    // 여기서는 메뉴 안에 올바른 href 의 링크가 노출됨까지만 확인한다.
    await expect(natChargeLink).toHaveAttribute('href', '/billing');
  });

  test('/billing 직접 접근 — heading 노출', async ({ writer }) => {
    const response = await writer.page.goto('/billing');
    expect(response?.status()).toBe(200);
    await expect(writer.page.getByRole('heading', { name: 'NAT 충전' })).toBeVisible();
  });
});
