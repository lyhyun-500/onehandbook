-- ============================================================================
-- reorder_episodes RPC — 프롤로그 제외 사양 (ADR-0031 정합).
--
-- 사양:
--   - 본 RPC 안 본편 (episode_type = 'episode') 단독 재정렬 path.
--   - 프롤로그 = episode_number 0 단독 고정, 재정렬 대상 0.
--   - 7 사이트 안 episode_type = 'episode' 필터 진입.
--
-- CREATE OR REPLACE 안 기존 (20260611120000) 안 덮어쓰기 정합.
-- 운영 적용 = LEE Studio SQL Editor 수동 path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reorder_episodes(
  p_work_id bigint,
  p_ordered_episode_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid bigint;
  v_author_id bigint;
  v_expected_count int;
  v_actual_count int;
  v_busy_count int;
  v_offset int;
  v_distinct_count int;
  v_input_len int;
BEGIN
  -- ─── 1. 권한 검증: auth.uid() → users.id → works.author_id ───────
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

  -- ─── 2. 진행 중 분석 잡 차단 (Q7 이중 가드 — RPC 측) ───────────
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

  -- ─── 3. 입력 검증: empty / 중복 / 길이 일치 / 전수 일치 ───────
  IF p_ordered_episode_ids IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_ordered_ids');
  END IF;

  v_input_len := COALESCE(array_length(p_ordered_episode_ids, 1), 0);
  IF v_input_len = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_ordered_ids');
  END IF;

  SELECT COUNT(*) INTO v_distinct_count
  FROM (SELECT DISTINCT unnest(p_ordered_episode_ids)) t;
  IF v_distinct_count != v_input_len THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_episode_ids');
  END IF;

  -- ─── 4. SELECT FOR UPDATE — 본편 단독 잠금 (프롤로그 제외) ───
  PERFORM 1
  FROM public.episodes
  WHERE work_id = p_work_id
    AND episode_type = 'episode'
  FOR UPDATE;

  SELECT COUNT(*) INTO v_expected_count
  FROM public.episodes
  WHERE work_id = p_work_id
    AND episode_type = 'episode';

  -- 전수 일치 검증: 배열 ↔ 본편 episodes 안 set 동일
  SELECT COUNT(*) INTO v_actual_count
  FROM public.episodes
  WHERE work_id = p_work_id
    AND episode_type = 'episode'
    AND id = ANY(p_ordered_episode_ids);

  IF v_actual_count != v_expected_count
     OR v_expected_count != v_input_len THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ordered_ids_mismatch',
      'expected', v_expected_count,
      'actual', v_actual_count,
      'input', v_input_len
    );
  END IF;

  -- ─── 5. UNIQUE 충돌 회피 — 본편 단독 offset 박음 ──────────
  SELECT COALESCE(MAX(episode_number), 0) + 1000000 INTO v_offset
  FROM public.episodes
  WHERE work_id = p_work_id
    AND episode_type = 'episode';

  -- pass 1: 본편 안 모든 row 안 (offset + 원 값) 임시 박음 → 충돌 0.
  --         프롤로그 (episode_number = 0) 안 변동 0 정합.
  UPDATE public.episodes
  SET episode_number = episode_number + v_offset,
      updated_at = now()
  WHERE work_id = p_work_id
    AND episode_type = 'episode';

  -- pass 2: 본편 단독 1..N 재할당 (앵커 = id).
  WITH new_order AS (
    SELECT t.id, t.ord::int AS new_number
    FROM unnest(p_ordered_episode_ids) WITH ORDINALITY AS t(id, ord)
  )
  UPDATE public.episodes e
  SET episode_number = no.new_number,
      updated_at = now()
  FROM new_order no
  WHERE e.id = no.id
    AND e.work_id = p_work_id
    AND e.episode_type = 'episode';

  -- ─── 6. work_facts 동기 UPDATE (본편 단독, episode_id 앵커 JOIN) ───
  -- 프롤로그 fact (episode_number = 0) 안 갱신 0 정합.
  UPDATE public.work_facts wf
  SET episode_number = e.episode_number
  FROM public.episodes e
  WHERE wf.episode_id = e.id
    AND wf.work_id = p_work_id
    AND e.episode_type = 'episode';

  -- ─── 7. work_entities.first_seen_episode = 갱신 0 (옵션 c, frozen) ─
  -- ─── 8. work_facts.episode_content_hash = 갱신 0 (Q6, frozen) ────

  RETURN jsonb_build_object(
    'ok', true,
    'work_id', p_work_id,
    'episode_count', v_expected_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_episodes(bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_episodes(bigint, bigint[]) TO authenticated;

COMMENT ON FUNCTION public.reorder_episodes(bigint, bigint[]) IS
  '회차 수동 재정렬 (ADR-0030 + ADR-0031). 본편 (episode_type = ''episode'') 단독 재정렬, 프롤로그 (episode_number = 0) 안 변동 0. episodes + work_facts.episode_number 동기 UPDATE. work_entities.first_seen_episode = frozen 사양. 진행 중 분석 잡 차단 + SELECT FOR UPDATE 가드.';
