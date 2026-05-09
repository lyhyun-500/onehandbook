import { expect, test } from '@playwright/test';
import { test as authTest } from '../fixtures/test-user';

// 작업 2 (Feature flag + /dev/* 차단) 8개 체크리스트 중 7개 자동화.
// #7 (production /dev/* 404)은 실 production 배포 환경 검증이라 e2e 범위 외 → skip 처리.

test.describe('Proxy guards — unauthenticated', () => {
  test('비로그인 /studio → /login으로 redirect', async ({ page }) => {
    await page.goto('/studio');
    expect(page.url()).toMatch(/\/login/);
  });

  test('비로그인 /works/[any] → redirect', async ({ page }) => {
    await page.goto('/works/e2e-guard-probe');
    expect(page.url()).not.toContain('/works/e2e-guard-probe');
  });

  test('비로그인 /billing → redirect', async ({ page }) => {
    await page.goto('/billing');
    expect(page.url()).not.toContain('/billing');
  });
});

authTest.describe('Proxy guards — authenticated user (writer)', () => {
  authTest('로그인 / → /studio redirect', async ({ writer }) => {
    await writer.page.goto('/');
    await expect(writer.page).toHaveURL(/\/studio/);
  });

  authTest('비-admin /admin → 차단', async ({ writer }) => {
    await writer.page.goto('/admin');
    expect(writer.page.url()).not.toContain('/admin');
  });
});

authTest.describe('Proxy guards — admin user', () => {
  authTest('admin /admin → 통과 (sanity check)', async ({ admin }) => {
    await admin.page.goto('/admin');
    await expect(admin.page).toHaveURL(/\/admin/);
  });
});

authTest.describe('Infrastructure routes — authenticated', () => {
  // /dashboard는 인증 사용자에게 /studio 별칭. 비인증 상태는 /login auth 게이트가 먼저 발동해 별칭 라우팅이 보이지 않음.
  authTest('/dashboard → /studio redirect (writer)', async ({ writer }) => {
    await writer.page.goto('/dashboard');
    await expect(writer.page).toHaveURL(/\/studio/);
  });
});

test.describe('Infrastructure routes — public', () => {
  test('/dev/flags 로컬 dev에서 200 응답', async ({ page }) => {
    const response = await page.goto('/dev/flags');
    expect(response?.status()).toBe(200);
  });

  test.skip('production /dev/* 차단 (e2e 범위 외)', () => {
    // 실 production 배포 + NEXT_PHASE=phase-production 검증이 필요해 e2e 자동화 X.
    // src/middleware.ts의 production 차단 로직은 작업 2에서 이미 단위 검증됨.
  });
});
