-- ============================================================================
-- reorder_episodes RPC — 회차 수동 재정렬 (ADR-0030 정합).
--
-- 사양:
--   - episode_number = 연재 순서값 재정의. episode_id = 불변 앵커.
--   - 갱신 대상 = episodes.episode_number + work_facts.episode_number 단독.
--   - work_entities.first_seen_episode = 갱신 0 (옵션 c, frozen 사양).
--   - frozen 사양 = analysis_runs.result_json / holistic_*.result_json /
--                  analysis_jobs.payload / holistic_pipeline_events.payload /
--                  reports.result_json / work_facts.episode_content_hash.
--
-- 가드:
--   - 권한 검증: auth.uid() → users.id → works.author_id 일치 사실.
--   - 진행 중 분석 잡 차단 (analysis_jobs.work_id + status pending/processing).
--   - SELECT FOR UPDATE = episodes 안 동시 재정렬 안 race 차단.
--   - UNIQUE 충돌 회피 = MAX + offset(1000000) 기반 2-pass.
--
-- 입력 검증:
--   - empty / 중복 / 외부 id / 길이 불일치 거부.
--
-- 운영 적용 = LEE Studio SQL Editor 수동 path (CLAUDE.md sufficient).
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

  -- 중복 검증
  SELECT COUNT(*) INTO v_distinct_count
  FROM (SELECT DISTINCT unnest(p_ordered_episode_ids)) t;
  IF v_distinct_count != v_input_len THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_episode_ids');
  END IF;

  -- ─── 4. SELECT FOR UPDATE — 동시 재정렬 race 차단 (Q8) ───────
  -- 본 작품 안 모든 episode row 잠금 (PERFORM = 결과 버림 정합).
  -- 집계 + FOR UPDATE 동시 사용 안 PostgreSQL 안 0A000 금지 사실
  -- → 잠금 + 카운트 2 step 분리.
  PERFORM 1
  FROM public.episodes
  WHERE work_id = p_work_id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_expected_count
  FROM public.episodes
  WHERE work_id = p_work_id;

  -- 전수 일치 검증: 배열 ↔ episodes 안 set 동일
  SELECT COUNT(*) INTO v_actual_count
  FROM public.episodes
  WHERE work_id = p_work_id
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

  -- ─── 5. UNIQUE 충돌 회피 — MAX 기반 offset (사전 큰 값 안 안전) ───
  SELECT COALESCE(MAX(episode_number), 0) + 1000000 INTO v_offset
  FROM public.episodes
  WHERE work_id = p_work_id;

  -- pass 1: 임시값 (offset + 원 값) → 모든 row 안 UNIQUE 충돌 0
  UPDATE public.episodes
  SET episode_number = episode_number + v_offset,
      updated_at = now()
  WHERE work_id = p_work_id;

  -- pass 2: 입력 순서대로 1..N 재할당 (앵커 = id)
  WITH new_order AS (
    SELECT t.id, t.ord::int AS new_number
    FROM unnest(p_ordered_episode_ids) WITH ORDINALITY AS t(id, ord)
  )
  UPDATE public.episodes e
  SET episode_number = no.new_number,
      updated_at = now()
  FROM new_order no
  WHERE e.id = no.id AND e.work_id = p_work_id;

  -- ─── 6. work_facts 동기 UPDATE (episode_id 앵커 JOIN) ─────────
  UPDATE public.work_facts wf
  SET episode_number = e.episode_number
  FROM public.episodes e
  WHERE wf.episode_id = e.id
    AND wf.work_id = p_work_id;

  -- ─── 7. work_entities.first_seen_episode = 갱신 0 (옵션 c, frozen) ─
  -- 사양: ADR-0030 영속화 — 추출 시점 frozen 사실 (read 사이트 0).
  -- UI 노출 진입 시 별도 backfill 의제 (first_seen_episode_id FK 컬럼 신설 path).

  -- ─── 8. work_facts.episode_content_hash = 갱신 0 (Q6, frozen) ────
  -- 사양: 본문 hash 단독 사실 = episode_number 무관 = 갱신 0 정합.

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
  '회차 수동 재정렬 (ADR-0030). episodes.episode_number + work_facts.episode_number 동기 UPDATE. work_entities.first_seen_episode = frozen 사양. 진행 중 분석 잡 차단 + SELECT FOR UPDATE 가드.';
