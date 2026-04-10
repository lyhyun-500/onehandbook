-- Ollama 파인튜닝 등 학습용: 유저 질문·AI 답변 쌍 + 큐레이터(사령관) 품질 표시

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_training_curator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_training_curator IS
  'training_logs 품질(is_good) 표시 권한; 사령관 계정만 true 권장';

CREATE TABLE IF NOT EXISTS public.training_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id bigint NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_message text NOT NULL,
  assistant_message text NOT NULL,
  is_good boolean NOT NULL DEFAULT false,
  good_marked_at timestamptz,
  good_marked_by_app_user_id bigint REFERENCES public.users (id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_logs_good_consistency CHECK (
    (
      NOT is_good
      AND good_marked_at IS NULL
      AND good_marked_by_app_user_id IS NULL
    )
    OR (
      is_good
      AND good_marked_at IS NOT NULL
      AND good_marked_by_app_user_id IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.training_logs IS
  '유저 질문·AI 답변 쌍; is_good 은 is_training_curator 가 표시(고품질 학습 데이터 선별)';

CREATE INDEX IF NOT EXISTS idx_training_logs_user_created
  ON public.training_logs (app_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_logs_good
  ON public.training_logs (is_good, created_at DESC)
  WHERE is_good = true;

ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_logs_select_own" ON public.training_logs;
CREATE POLICY "training_logs_select_own" ON public.training_logs
  FOR SELECT TO authenticated
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "training_logs_select_curator" ON public.training_logs;
CREATE POLICY "training_logs_select_curator" ON public.training_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_training_curator = true
    )
  );

DROP POLICY IF EXISTS "training_logs_insert_own" ON public.training_logs;
CREATE POLICY "training_logs_insert_own" ON public.training_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.training_logs TO authenticated;
GRANT ALL ON public.training_logs TO service_role;

-- 큐레이터만 호출: 해당 로그에 is_good = true 및 표시자 기록
CREATE OR REPLACE FUNCTION public.mark_training_log_good(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_id bigint;
  already boolean;
BEGIN
  SELECT id INTO cur_id FROM public.users WHERE auth_id = auth.uid();
  IF cur_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (SELECT COALESCE(is_training_curator, false) FROM public.users WHERE id = cur_id) THEN
    RAISE EXCEPTION 'training curator only';
  END IF;

  SELECT is_good INTO already FROM public.training_logs WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'training_log not found';
  END IF;
  IF already THEN
    RETURN;
  END IF;

  UPDATE public.training_logs
  SET
    is_good = true,
    good_marked_at = now(),
    good_marked_by_app_user_id = cur_id
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_training_log_good(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_training_log_good(uuid) TO authenticated;
