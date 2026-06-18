-- ============================================================================
-- delete_episode_and_reorder RPC — 회차 삭제 + 본편 재배치 (atomic).
--
-- 사양 (ADR-0032 정합):
--   - 단건 삭제 + 남은 본편 1..N 재배치 단일 트랜잭션 사양.
--   - 본편 = DELETE → reorder_episodes(PERFORM) 안 atomic 정합.
--   - 프롤로그 = 단순 DELETE (재배치 무관 사실, partial unique index 자동 해제).
--   - 본편 N=1 마지막 삭제 = DELETE + total_episodes=0 단독 (재배치 skip).
--
-- 가드:
--   - 권한 검증 (auth.uid() → users.id → works.author_id).
--   - 진행 중 분석 잡 차단 (M1 reorder 패턴 답습).
--   - SELECT FOR UPDATE 안 race 차단.
--
-- 의존:
--   - public.reorder_episodes(p_work_id, p_ordered_episode_ids) RPC 사실
--     (migrations/20260615120100_reorder_episodes_prologue_exclude.sql).
--   - reorder_episodes 안 시그니처 변경 시 본 RPC 안 동반 변경 path 단독.
--
-- Cascade 사실 (자동 제거 path):
--   - analysis_jobs / analysis_results / analysis_runs / episode_memos /
--     work_facts (전수 ON DELETE CASCADE 사실).
--   - holistic_analysis_runs.episode_ids[] / reader_actions = stale 잔존 사실
--     (ADR-0030/0031 frozen 사양 정합).
--   - work_entities.first_seen_episode = stale episode_number 잔존 (FK 0).
--
-- 운영 적용 = LEE Studio SQL Editor 수동 path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_episode_and_reorder(
  p_work_id bigint,
  p_episode_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid bigint;
  v_author_id bigint;
  v_busy_count int;
  v_episode_type text;
  v_episode_number int;
  v_remaining_ids bigint[];
  v_remaining_count int;
  v_reorder_result jsonb;
BEGIN
  -- ─── 1. 권한 검증 ────────────────────────────────────────
  SELECT id INTO v_uid
  FROM public.users
  WHERE auth_id = auth.uid() AND deleted_at IS NULL;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  SELECT author_id INTO v_author_id
  FROM public.works
  WHERE id = p_work_id AND deleted_at IS NULL;

  IF v_author_id IS NULL OR v_author_id != v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- ─── 2. 진행 중 분석 잡 차단 (M1 reorder 패턴 답습) ───────
  SELECT COUNT(*) INTO v_busy_count
  FROM public.analysis_jobs
  WHERE work_id = p_work_id
    AND status IN ('pending', 'processing');

  IF v_busy_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'analysis_in_progress',
      'busy_count', v_busy_count
    );
  END IF;

  -- ─── 3. episode 존재 + work_id 정합 검증 + SELECT FOR UPDATE ──
  SELECT episode_type, episode_number
  INTO v_episode_type, v_episode_number
  FROM public.episodes
  WHERE id = p_episode_id AND work_id = p_work_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- ─── 4. DELETE (CASCADE 안 자동 부속 데이터 제거) ─────────
  DELETE FROM public.episodes WHERE id = p_episode_id;

  -- ─── 5. 프롤로그 = 재배치 skip 단독 path ──────────────────
  IF v_episode_type = 'prologue' THEN
    UPDATE public.works
    SET total_episodes = (
      SELECT COUNT(*)
      FROM public.episodes
      WHERE work_id = p_work_id AND episode_type = 'episode'
    )
    WHERE id = p_work_id;

    RETURN jsonb_build_object(
      'ok', true,
      'deleted_episode_number', 0,
      'episode_type', 'prologue',
      'reordered_count', 0
    );
  END IF;

  -- ─── 6. 본편 = 남은 본편 1..N 재배치 (PERFORM reorder_episodes) ──
  SELECT array_agg(id ORDER BY episode_number ASC), COUNT(*)
  INTO v_remaining_ids, v_remaining_count
  FROM public.episodes
  WHERE work_id = p_work_id AND episode_type = 'episode';

  -- 본편 N=1 마지막 삭제 = v_remaining_count=0 → reorder skip.
  IF v_remaining_count > 0 THEN
    v_reorder_result := public.reorder_episodes(p_work_id, v_remaining_ids);
    IF NOT (v_reorder_result ->> 'ok')::boolean THEN
      -- reorder 안 race 안 실패 시 = RAISE EXCEPTION 안 트랜잭션 rollback →
      -- DELETE 자동 복원 정합. 본 RPC 안 호출자 = API 안 500 응답 path.
      RAISE EXCEPTION 'reorder failed after delete: %', v_reorder_result ->> 'error';
    END IF;
  END IF;

  -- ─── 7. works.total_episodes 갱신 (본편 단독 count) ───────
  UPDATE public.works SET total_episodes = v_remaining_count WHERE id = p_work_id;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_episode_number', v_episode_number,
    'episode_type', 'episode',
    'reordered_count', v_remaining_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_episode_and_reorder(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_episode_and_reorder(bigint, bigint) TO authenticated;

COMMENT ON FUNCTION public.delete_episode_and_reorder(bigint, bigint) IS
  '회차 삭제 + 본편 재배치 단일 트랜잭션 (ADR-0032). reorder_episodes 안 PERFORM 의존 사실. 본편 = DELETE + 재배치, 프롤로그 = 단순 DELETE. CASCADE 안 analysis_runs/results/jobs/memos/work_facts 자동 제거. holistic_analysis_runs.episode_ids[] / work_entities.first_seen_episode / reader_actions = frozen 잔존 사실.';
