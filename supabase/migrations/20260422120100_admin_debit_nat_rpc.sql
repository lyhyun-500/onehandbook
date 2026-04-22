-- =============================================================================
-- admin_debit_nat: 어드민이 유저의 NAT(코인) 잔량을 수동 차감
--   - credit_nat 과 대칭 구조, service_role 전용 (authenticated 호출 금지)
--   - 차감 시 coin_logs 에 type='USE', reason='ADMIN_DEBIT' 로 감사 로그 기록
--   - metadata 에 조정자(auth_id) 와 자유 사유(admin_reason) 병합
--   - 잔량 음수 불가, amount > 0 강제
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_debit_nat(
  p_user_id bigint,
  p_amount integer,
  p_admin_reason text,
  p_admin_auth_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal int;
  v_new int;
  v_meta jsonb;
BEGIN
  -- 금액 유효성: 1 이상, 상한 100000 (credit_nat 와 동일 상한)
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- 사유 필수 (공백 제외 1자 이상, 500자 이하)
  IF p_admin_reason IS NULL OR length(trim(p_admin_reason)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_reason_required');
  END IF;

  IF length(p_admin_reason) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_reason_too_long');
  END IF;

  -- 조정자 식별 필수
  IF p_admin_auth_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_auth_id_required');
  END IF;

  -- 대상 유저 잠금 조회 (탈퇴 유저는 차감 불가)
  SELECT coin_balance INTO v_bal
  FROM public.users
  WHERE id = p_user_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- 잔량 음수 방지
  IF v_bal < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'balance', v_bal,
      'required', p_amount
    );
  END IF;

  -- 잔량 차감 (race condition 방어: WHERE 에 >= p_amount 재확인)
  UPDATE public.users
  SET coin_balance = coin_balance - p_amount
  WHERE id = p_user_id
    AND coin_balance >= p_amount
    AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'update_failed');
  END IF;

  -- metadata 에 조정자 및 자유 사유 병합 (전달된 metadata 와 합쳐서 저장)
  v_meta := COALESCE(p_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'adjusted_by', p_admin_auth_id,
              'admin_reason', p_admin_reason
            );

  INSERT INTO public.coin_logs (
    user_id, amount, type, reason, metadata
  ) VALUES (
    p_user_id,
    -p_amount,
    'USE',
    'ADMIN_DEBIT',
    v_meta
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_debit_nat(
  bigint, integer, text, uuid, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_debit_nat(
  bigint, integer, text, uuid, jsonb
) TO service_role;

COMMENT ON FUNCTION public.admin_debit_nat(bigint, integer, text, uuid, jsonb) IS
  '어드민 수동 차감 — 서버 API 에서 service_role 로만 호출. coin_logs 감사 기록 자동.';
