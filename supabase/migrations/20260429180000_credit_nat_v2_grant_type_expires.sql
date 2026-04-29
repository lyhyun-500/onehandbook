-- ADR-0011: NAT 회계 분류 + 유효기간 5년 정책 적용
-- credit_nat RPC v2: 기존 함수에 grant_type + expires_at 인자 추가
-- 하위 호환: 기존 호출 코드 그대로 작동 (자동 추론)

-- ADR-0011 적용 전 v1 (인자 6개) 명시적 제거
-- v1 시그니처: (bigint, integer, text, text, bigint, jsonb)
-- v2 시그니처: (bigint, integer, text, text, bigint, jsonb, timestamptz, text)
-- → CREATE OR REPLACE 가 시그니처 다른 이유로 덮어쓰기 불가, 명시적 DROP 필요
DROP FUNCTION IF EXISTS public.credit_nat(
  bigint, integer, text, text, bigint, jsonb
);

CREATE OR REPLACE FUNCTION public.credit_nat(
  p_user_id bigint,
  p_amount integer,
  p_reason text,
  p_ref_type text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_grant_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
  v_reason text;
  v_grant_type text;
  v_expires_at timestamptz;
  v_meta jsonb;
BEGIN
  -- amount 검증
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- reason 검증
  IF p_reason IS NULL OR p_reason NOT IN (
    'purchase_credit', 'refund', 'bonus', 'admin_adjust', 'manual_adjust', 'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  -- grant_type 자동 추론 (ADR-0011)
  IF p_grant_type IS NULL THEN
    v_grant_type := CASE p_reason
      WHEN 'purchase_credit' THEN 'paid'
      WHEN 'refund' THEN 'paid'
      ELSE 'bonus'
    END;
  ELSIF p_grant_type IN ('paid', 'bonus') THEN
    v_grant_type := p_grant_type;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_grant_type');
  END IF;

  -- expires_at 기본값 5년 (ADR-0011)
  v_expires_at := COALESCE(p_expires_at, now() + INTERVAL '5 years');

  -- reason → coin_logs.reason 매핑 (기존 그대로)
  v_reason := CASE p_reason
    WHEN 'purchase_credit' THEN 'PURCHASE_CREDIT'
    WHEN 'refund' THEN 'REFUND'
    WHEN 'bonus' THEN 'BONUS'
    WHEN 'admin_adjust' THEN 'ADMIN_CREDIT'
    WHEN 'manual_adjust' THEN 'MANUAL_ADJUST'
    ELSE 'OTHER'
  END;

  -- 잔량 업데이트
  UPDATE public.users
  SET coin_balance = coin_balance + p_amount
  WHERE id = p_user_id AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- metadata 에 grant_type + expires_at 박기 (ADR-0011)
  v_meta := COALESCE(p_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'grant_type', v_grant_type,
              'expires_at', v_expires_at
            );

  -- coin_logs INSERT
  INSERT INTO public.coin_logs (
    user_id, amount, type, reason, ref_type, ref_id, metadata
  ) VALUES (
    p_user_id,
    p_amount,
    'EARN',
    v_reason,
    p_ref_type,
    p_ref_id,
    v_meta
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_new,
    'grant_type', v_grant_type,
    'expires_at', v_expires_at
  );
END;
$$;

-- 권한 부여 (기존 함수 권한 유지)
GRANT EXECUTE ON FUNCTION public.credit_nat(
  bigint, integer, text, text, bigint, jsonb, timestamptz, text
) TO service_role;

-- 검증용 주석
COMMENT ON FUNCTION public.credit_nat(
  bigint, integer, text, text, bigint, jsonb, timestamptz, text
) IS
  'ADR-0011: NAT 회계 분류 + 유효기간 5년. grant_type 자동 추론, expires_at 기본 5년 후. 하위 호환 보장.';
