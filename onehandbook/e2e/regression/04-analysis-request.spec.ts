import { test, expect } from '../fixtures/test-user';
import { getAdminClient, getAuthenticatedClient } from '../fixtures/auth';
import { seedEpisode } from '../fixtures/seed';

// 페이즈 3-2 결정 (옵션 1+2 조합):
//   /api/analyze 는 job 생성/응답만 동기 처리하고, 실 NAT 차감(consume_nat)은 background
//   worker 가 LLM 성공 후 호출. fake API key 환경에서는 worker 가 실 LLM 미호출(401 fail)이라
//   엔드포인트 단독으로는 NAT 차감을 검증 못함.
//   → test 1: API + jobs 생성 (money path 트리거 검증)
//   → test 2: consume_nat RPC 직접 호출 (NAT pipeline health 검증)
//   → test 3: NAT 부족 시 INSUFFICIENT_NAT (negative case)

// 같은 writer.userId 의 coin_balance 를 세 테스트가 모두 만지므로 병렬 실행 시 race.
// test 3 의 UPDATE coin_balance=0 가 test 1 의 balance>=cost 검사와 충돌해 일관성 깨짐.
test.describe.configure({ mode: 'serial' });

test.describe('Analysis request — writer (API + DB money path)', () => {
  test('test 1: POST /api/analyze → 200 + job_id + analysis_jobs row', async ({ writer }) => {
    const admin = getAdminClient();
    const episodeNumber = 200 + Math.floor(Math.random() * 1000);
    let episodeId: number | undefined;
    let jobId: string | undefined;

    try {
      episodeId = await seedEpisode(writer.seededWorkId, {
        episodeNumber,
        title: `E2E 분석요청 회차 ${episodeNumber}`,
      });

      const response = await writer.page.request.post('/api/analyze', {
        data: {
          episodeId,
          agentVersion: 'kakao-page',
          includeLore: false,
          includePlatformOptimization: false,
        },
      });
      expect(response.status(), `body=${await response.text()}`).toBe(200);
      const body = (await response.json()) as {
        job_id?: string;
        required_nat?: number;
        balance?: number;
      };
      expect(body.job_id).toBeDefined();
      expect(typeof body.required_nat).toBe('number');
      expect((body.required_nat as number) > 0).toBe(true);
      jobId = body.job_id;

      const { data: job, error: jobErr } = await admin
        .from('analysis_jobs')
        .select('id, app_user_id, episode_id, status')
        .eq('id', jobId!)
        .maybeSingle();
      if (jobErr) throw jobErr;
      expect(job).toBeTruthy();
      expect(job?.app_user_id).toBe(writer.userId);
      expect(job?.episode_id).toBe(episodeId);
      // background worker 가 fake key 로 fail 한 경우 status='failed' 도 정상 — 여기서는
      // pending|processing|failed 어느 단계든 row 가 생긴 것만 확인.
      expect(['pending', 'processing', 'failed', 'completed']).toContain(job?.status);
    } finally {
      if (jobId) await admin.from('analysis_jobs').delete().eq('id', jobId);
      if (episodeId) await admin.from('episodes').delete().eq('id', episodeId);
    }
  });

  test('test 2: consume_nat RPC 직접 호출 → 1 NAT 차감 + ok=true', async ({ writer }) => {
    const admin = getAdminClient();
    const writerClient = await getAuthenticatedClient('writer');

    try {
      // 호출 전 잔량 확인 (fixture 보장: 30)
      const { data: before } = await admin
        .from('users')
        .select('coin_balance')
        .eq('id', writer.userId)
        .single();
      expect(before?.coin_balance).toBe(30);

      const { data, error } = await writerClient.rpc('consume_nat', {
        p_amount: 1,
        p_ref_type: 'e2e_test',
        p_ref_id: 0,
        p_metadata: { e2e: true },
      });
      if (error) throw new Error(`consume_nat error: ${error.message}`);
      const result = data as { ok?: boolean; balance?: number; error?: string };
      expect(result, `consume_nat response: ${JSON.stringify(data)}`).toMatchObject({ ok: true });

      const { data: after } = await admin
        .from('users')
        .select('coin_balance')
        .eq('id', writer.userId)
        .single();
      expect(after?.coin_balance).toBe(29);
    } finally {
      // NAT 잔량을 30으로 복구
      await admin.from('users').update({ coin_balance: 30 }).eq('id', writer.userId);
    }
  });

  test('test 3: NAT 부족 → 402 INSUFFICIENT_NAT', async ({ writer }) => {
    const admin = getAdminClient();
    const episodeNumber = 300 + Math.floor(Math.random() * 1000);
    let episodeId: number | undefined;

    try {
      // 1. NAT 잔량을 0으로 강제
      await admin.from('users').update({ coin_balance: 0 }).eq('id', writer.userId);

      // 2. 회차 시드
      episodeId = await seedEpisode(writer.seededWorkId, {
        episodeNumber,
        title: `E2E 부족테스트 회차 ${episodeNumber}`,
      });

      // 3. /api/analyze 호출 → 402 + INSUFFICIENT_NAT
      const { data: precheck } = await admin
        .from('users')
        .select('coin_balance')
        .eq('id', writer.userId)
        .single();
      const response = await writer.page.request.post('/api/analyze', {
        data: {
          episodeId,
          agentVersion: 'kakao-page',
          includeLore: false,
          includePlatformOptimization: false,
        },
      });
      expect(
        response.status(),
        `precheck balance=${precheck?.coin_balance}, body=${await response.text()}`,
      ).toBe(402);
      const body = (await response.json()) as {
        code?: string;
        required?: number;
        balance?: number;
      };
      expect(body.code).toBe('INSUFFICIENT_NAT');
      expect(body.balance).toBe(0);
      expect(typeof body.required).toBe('number');
    } finally {
      if (episodeId) await admin.from('episodes').delete().eq('id', episodeId);
      // NAT 잔량을 30으로 복구
      await admin.from('users').update({ coin_balance: 30 }).eq('id', writer.userId);
    }
  });
});
