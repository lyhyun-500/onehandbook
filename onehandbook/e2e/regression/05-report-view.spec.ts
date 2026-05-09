import { test, expect } from '../fixtures/test-user';
import { getAdminClient } from '../fixtures/auth';
import { seedEpisode, seedAnalysisRun, seedAnalysisJob } from '../fixtures/seed';

// 주의 (페이즈 3-2 결정 사항):
//   AnalyzePanel/WorkAnalysisHub는 focus URL 단독으로는 result_json.dimensions 를
//   panel의 결과 모드로 자동 렌더링하지 않는다 (focus는 분석-시작 prompt를 띄움).
//   dimension 라벨까지 검증하려면 분석-실행 후 결과 모드 진입 인터랙션이 추가로 필요한데,
//   해당 흐름은 spec 04와 겹치고 AnalyzePanel.tsx (1000+ 줄) 의 selector 추출이 별건이다.
//   여기서는 (a) 분석 페이지가 정상 로드되고 (b) 시드된 회차/run 이 API 응답에 포함되며
//   (c) DB 시드가 의도대로 들어갔는지를 smoke 수준으로 검증한다.
//   심층 dimension UI 검증은 testid 부분 도입 결정 후 별도 spec 으로 분리.

test.describe('Analysis report view — writer (smoke)', () => {
  test('시드된 episode + run 이 분석 페이지/DB 양쪽에 보임', async ({ writer }) => {
    const admin = getAdminClient();
    const episodeNumber = 100 + Math.floor(Math.random() * 1000);
    let episodeId: number | undefined;
    let runId: number | undefined;
    let jobId: string | undefined;

    try {
      episodeId = await seedEpisode(writer.seededWorkId, {
        episodeNumber,
        title: `E2E 회차 ${episodeNumber}`,
      });
      runId = await seedAnalysisRun(episodeId, writer.seededWorkId);
      jobId = await seedAnalysisJob(writer.userId, episodeId, runId, 'completed');

      // analysis_data API 응답 캡처 — 백그라운드 fetch가 시드 데이터를 정확히 반환하는지 검증
      const dataResp = writer.page.waitForResponse(
        (r) =>
          r.url().includes(`/api/works/${writer.seededWorkId}/analysis-data`) &&
          r.status() === 200,
      );
      await writer.page.goto(`/works/${writer.seededWorkId}/analysis?focus=${episodeId}`);
      const resp = await dataResp;
      const body = (await resp.json()) as {
        episodes: Array<{ id: number; episode_number: number; title: string }>;
        runs: Array<{ id: number; episode_id: number; result_json: Record<string, unknown> }>;
      };

      // (a) 페이지 로드
      await expect(writer.page.getByRole('heading', { name: 'AI 분석' })).toBeVisible();

      // (b) 회차 목록 row 노출 (시드된 episode_number 화 노출)
      await expect(writer.page.getByText(`${episodeNumber}화`).first()).toBeVisible();

      // (c) API 응답에 시드된 run 포함 + dimension 스키마 정합성 확인
      expect(body.episodes.some((e) => e.id === episodeId)).toBe(true);
      expect(body.runs.some((r) => r.id === runId && r.episode_id === episodeId)).toBe(true);

      const seedRun = body.runs.find((r) => r.id === runId);
      const dims = (seedRun?.result_json as { dimensions?: Record<string, unknown> }).dimensions;
      expect(dims).toBeDefined();
      expect(dims).toHaveProperty('hook_strength');
      expect(dims).toHaveProperty('character_appeal');
      expect((dims as Record<string, { score: number }>).hook_strength.score).toBe(80);
    } finally {
      // FK 역순 정리: jobs → runs → episodes (work는 시드본 유지)
      if (jobId) await admin.from('analysis_jobs').delete().eq('id', jobId);
      if (runId) await admin.from('analysis_runs').delete().eq('id', runId);
      if (episodeId) await admin.from('episodes').delete().eq('id', episodeId);
    }
  });
});
