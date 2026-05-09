import { test, expect } from '../fixtures/test-user';
import { getAdminClient } from '../fixtures/auth';

test.describe('Novel create — writer', () => {
  test('작품 등록 모달 → DB INSERT + 모달 닫힘 + 카드 노출', async ({ writer }) => {
    const uniqueTitle = `E2E 신규 작품 ${Date.now()}`;
    const admin = getAdminClient();

    const { count: before, error: beforeErr } = await admin
      .from('works')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', writer.userId)
      .is('deleted_at', null);
    if (beforeErr) throw beforeErr;

    try {
      await writer.page.goto('/studio');
      // 트리거 버튼은 "작품 등록"; 모달 안 submit 버튼은 "등록" (정확 일치 필요)
      await writer.page.getByRole('button', { name: '작품 등록' }).click();
      await expect(writer.page.getByRole('heading', { name: '새 작품 등록' })).toBeVisible();

      await writer.page.getByPlaceholder('작품 제목을 입력하세요').fill(uniqueTitle);
      await writer.page.getByRole('button', { name: '등록', exact: true }).click();

      // 모달 닫힘 (heading 사라짐) — INSERT 완료 신호
      await expect(writer.page.getByRole('heading', { name: '새 작품 등록' })).toBeHidden();

      // DB 검증 (1차, 가장 신뢰): 카운트 +1, 정확한 제목/장르
      const { count: after, error: afterErr } = await admin
        .from('works')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', writer.userId)
        .is('deleted_at', null);
      if (afterErr) throw afterErr;
      expect(after).toBe((before ?? 0) + 1);

      const { data: newRow, error: rowErr } = await admin
        .from('works')
        .select('id, title, genre')
        .eq('author_id', writer.userId)
        .eq('title', uniqueTitle)
        .maybeSingle();
      if (rowErr) throw rowErr;
      expect(newRow?.title).toBe(uniqueTitle);
      expect(newRow?.genre).toBe('로맨스'); // 기본값 그대로 제출

      // UI 검증 (2차): /studio 명시적 재방문 후 새 카드 노출. router.refresh() 비동기 race 회피.
      await writer.page.goto('/studio');
      await expect(writer.page.getByText(uniqueTitle).first()).toBeVisible();
    } finally {
      // cleanup: 신규 작품 삭제 (idempotent re-run 보장)
      await admin.from('works').delete().eq('title', uniqueTitle);
    }
  });
});
