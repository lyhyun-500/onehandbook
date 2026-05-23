import { test, expect } from '../../fixtures/test-user';
import { getAdminClient } from '../../fixtures/auth';
import { seedStudioBaselineWorks } from '../../fixtures/seed';

/**
 * /studio 페이지 visual baseline — guard.
 *
 * Phase 2-D 마이그레이션 결과물 회귀 검출. ADR-0025 참조.
 * 변경 발생 시 LEE 명시 승인 후 baseline 갱신.
 *
 * 검증 케이스 (LEE 결정):
 *  1. 작품 있는 + filter=전체 + layout=card  (writer fixture + studio-baseline seed)
 *  2. 작품 있는 + filter=완결 + layout=list  (writer fixture + studio-baseline seed)
 *  3. 베타 카피 변종 (writer with phone_verified_at 임시 null)
 *  4. 빈 상태 (empty role fixture)
 *
 * 시간 결정성: page.clock.install 로 KST 정오 (2026-05-13T12:00:00+09:00) 고정.
 * seedStudioBaselineWorks 의 analysis_runs.created_at 매핑과 맞물려
 * lastAnalyzedAt 라벨 = "1일 전" / "1주 전" / "2주 전" / "3개월 전" 4 단계 결정적.
 *
 * mask:
 *  - 헤더 이메일/NAT 배지: 환경별 다름 → 마스킹
 *  - 알림 벨: HeaderAnalysisBell 폴링/aria-live → 마스킹
 *  - Next.js dev indicator: dev 모드 잔존 요소
 */

const FIXED_CLOCK_TIME = '2026-05-13T12:00:00+09:00';

const HEADER_MASK_SELECTORS = (page: import('@playwright/test').Page) => [
  page.locator('[data-next-mark]'),
  page.locator('[data-nextjs-toast]'),
  // 헤더 우측 영역 (NAT 배지 + 알림 벨 + 메뉴) — 환경별/시점별 변동 영역
  page.locator('header [aria-label="공지사항"]'),
  page.locator('header [aria-label="메뉴 열기"]'),
  // NAT 배지 텍스트 자체는 클래스 기반 마스킹이 어려워 헤더 전체 우측 nav 마스킹
];

test.describe('Visual baseline (guard) — /studio', () => {
  test.describe.configure({ mode: 'serial' });

  test('작품 있는 / filter=전체 / layout=card', async ({ writer }) => {
    await seedStudioBaselineWorks(writer.authUserId);
    await writer.page.emulateMedia({ reducedMotion: 'reduce' });
    await writer.page.clock.install({ time: FIXED_CLOCK_TIME });
    await writer.page.goto('/studio');
    // Hero heading 등장으로 server fetch + render 완료 신호
    await writer.page.getByRole('heading', { name: /오늘도 작업실을 엽니다/ }).waitFor();
    // 적어도 1개 작품 카드 노출 확인
    await expect(
      writer.page.getByText('E2E baseline · 황실의 그림자').first(),
    ).toBeVisible();

    await expect(writer.page).toHaveScreenshot('studio-writer-all-card.png', {
      fullPage: true,
      mask: HEADER_MASK_SELECTORS(writer.page),
    });
  });

  test('작품 있는 / filter=완결 / layout=list', async ({ writer }) => {
    await seedStudioBaselineWorks(writer.authUserId);
    await writer.page.emulateMedia({ reducedMotion: 'reduce' });
    await writer.page.clock.install({ time: FIXED_CLOCK_TIME });
    await writer.page.goto('/studio');
    await writer.page.getByRole('heading', { name: /오늘도 작업실을 엽니다/ }).waitFor();

    // 레이아웃 토글 → list
    await writer.page.getByRole('button', { name: '리스트 레이아웃' }).click();
    // 필터 토글 → 완결
    await writer.page.getByRole('tab', { name: '완결' }).click();

    // 완결 필터 후 구단주의 백서만 노출
    await expect(
      writer.page.getByText('E2E baseline · 구단주의 백서').first(),
    ).toBeVisible();

    await expect(writer.page).toHaveScreenshot('studio-writer-done-list.png', {
      fullPage: true,
      mask: HEADER_MASK_SELECTORS(writer.page),
    });
  });

  test('베타 카피 변종 — writer phone_verified_at 임시 null', async ({ writer }) => {
    await seedStudioBaselineWorks(writer.authUserId);
    const admin = getAdminClient();
    // 베타 배너는 phone_verified_at IS NULL 일 때만 노출 (studio/page.tsx:109).
    // try/finally 로 즉시 복원 — 병렬 spec 영향 최소화 (test.describe.configure serial 적용됨).
    const restoreTs = new Date().toISOString();
    const { error: nullErr } = await admin
      .from('users')
      .update({ phone_verified_at: null })
      .eq('id', writer.userId);
    if (nullErr) throw new Error(`phone_verified_at null 적용 실패: ${nullErr.message}`);

    try {
      await writer.page.emulateMedia({ reducedMotion: 'reduce' });
      await writer.page.clock.install({ time: FIXED_CLOCK_TIME });
      await writer.page.goto('/studio');
      await writer.page.getByRole('heading', { name: /오늘도 작업실을 엽니다/ }).waitFor();

      // 베타 배너 노출 확인
      await expect(
        writer.page.getByText(/베타 오픈 기념/),
      ).toBeVisible();

      await expect(writer.page).toHaveScreenshot('studio-writer-beta-banner.png', {
        fullPage: true,
        mask: HEADER_MASK_SELECTORS(writer.page),
      });
    } finally {
      const { error: restoreErr } = await admin
        .from('users')
        .update({ phone_verified_at: restoreTs })
        .eq('id', writer.userId);
      if (restoreErr) {
        // 복원 실패는 후속 spec 의 phone_verified 가정 깨므로 명시 throw
        throw new Error(`phone_verified_at 복원 실패: ${restoreErr.message}`);
      }
    }
  });

  test('빈 상태 — empty role / StudioEmptyState', async ({ empty }) => {
    await empty.page.emulateMedia({ reducedMotion: 'reduce' });
    await empty.page.clock.install({ time: FIXED_CLOCK_TIME });
    await empty.page.goto('/studio');
    // 빈 상태 hero heading 등장
    await empty.page.getByRole('heading', { name: /작업실에 오신 걸 환영해요/ }).waitFor();
    // 샘플 분석 링크 노출
    await expect(empty.page.getByRole('link', { name: /샘플 분석 열기/ })).toBeVisible();
    await expect(empty.page.getByRole('link', { name: /요금 자세히 보기/ })).toBeVisible();

    await expect(empty.page).toHaveScreenshot('studio-empty.png', {
      fullPage: true,
      mask: HEADER_MASK_SELECTORS(empty.page),
    });
  });
});
