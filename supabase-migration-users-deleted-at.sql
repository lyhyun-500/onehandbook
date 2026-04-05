-- 회원 탈퇴(소프트 딜리트) + 탈퇴 계정 RLS 차단
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.users.deleted_at IS '탈퇴 시각(소프트 딜리트). NULL이면 정상 계정';

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users (deleted_at) WHERE deleted_at IS NOT NULL;

-- ----- users -----
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT
  USING (auth_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users FOR INSERT
  WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING (auth_id = auth.uid() AND deleted_at IS NULL);

-- ----- works -----
DROP POLICY IF EXISTS "works_select_own" ON public.works;
CREATE POLICY "works_select_own" ON public.works FOR SELECT
  USING (author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));
DROP POLICY IF EXISTS "works_insert_own" ON public.works;
CREATE POLICY "works_insert_own" ON public.works FOR INSERT
  WITH CHECK (author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));
DROP POLICY IF EXISTS "works_update_own" ON public.works;
CREATE POLICY "works_update_own" ON public.works FOR UPDATE
  USING (author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));
DROP POLICY IF EXISTS "works_delete_own" ON public.works;
CREATE POLICY "works_delete_own" ON public.works FOR DELETE
  USING (author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));

-- ----- reader_actions -----
DROP POLICY IF EXISTS "reader_actions_select_for_author" ON public.reader_actions;
CREATE POLICY "reader_actions_select_for_author" ON public.reader_actions FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );

-- ----- episodes -----
DROP POLICY IF EXISTS "episodes_select_for_author" ON public.episodes;
CREATE POLICY "episodes_select_for_author" ON public.episodes FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "episodes_insert_for_author" ON public.episodes;
CREATE POLICY "episodes_insert_for_author" ON public.episodes FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "episodes_update_for_author" ON public.episodes;
CREATE POLICY "episodes_update_for_author" ON public.episodes FOR UPDATE
  USING (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "episodes_delete_for_author" ON public.episodes;
CREATE POLICY "episodes_delete_for_author" ON public.episodes FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );

-- ----- analysis_runs -----
DROP POLICY IF EXISTS "analysis_runs_select_author" ON public.analysis_runs;
CREATE POLICY "analysis_runs_select_author" ON public.analysis_runs FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "analysis_runs_insert_author" ON public.analysis_runs;
CREATE POLICY "analysis_runs_insert_author" ON public.analysis_runs FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "analysis_runs_delete_author" ON public.analysis_runs;
CREATE POLICY "analysis_runs_delete_author" ON public.analysis_runs FOR DELETE
  USING (
    work_id IN (
      SELECT w.id FROM public.works w JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );

-- ----- analysis_results -----
DROP POLICY IF EXISTS "analysis_results_select_author" ON public.analysis_results;
CREATE POLICY "analysis_results_select_author" ON public.analysis_results FOR SELECT
  USING (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "analysis_results_insert_author" ON public.analysis_results;
CREATE POLICY "analysis_results_insert_author" ON public.analysis_results FOR INSERT
  WITH CHECK (
    work_id IN (
      SELECT w.id FROM public.works w
      JOIN public.users u ON w.author_id = u.id
      WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
    )
  );

-- ----- sms_otp_challenges -----
DROP POLICY IF EXISTS "sms_otp_own" ON public.sms_otp_challenges;
CREATE POLICY "sms_otp_own" ON public.sms_otp_challenges FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));

-- ----- payments / nat_ledger -----
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));

DROP POLICY IF EXISTS "nat_ledger_select_own" ON public.nat_ledger;
CREATE POLICY "nat_ledger_select_own" ON public.nat_ledger FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL));

-- ----- analysis_jobs -----
DROP POLICY IF EXISTS "analysis_jobs_select_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_select_own" ON public.analysis_jobs FOR SELECT
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "analysis_jobs_insert_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_insert_own" ON public.analysis_jobs FOR INSERT
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS "analysis_jobs_update_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_update_own" ON public.analysis_jobs FOR UPDATE
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND deleted_at IS NULL)
  );

-- ----- holistic_analysis_runs (테이블 있을 때만) -----
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'holistic_analysis_runs'
  ) THEN
    DROP POLICY IF EXISTS "holistic_analysis_select_author" ON public.holistic_analysis_runs;
    CREATE POLICY "holistic_analysis_select_author" ON public.holistic_analysis_runs FOR SELECT
      USING (
        work_id IN (
          SELECT w.id FROM public.works w
          JOIN public.users u ON w.author_id = u.id
          WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
        )
      );
    DROP POLICY IF EXISTS "holistic_analysis_insert_author" ON public.holistic_analysis_runs;
    CREATE POLICY "holistic_analysis_insert_author" ON public.holistic_analysis_runs FOR INSERT
      WITH CHECK (
        work_id IN (
          SELECT w.id FROM public.works w
          JOIN public.users u ON w.author_id = u.id
          WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
        )
      );
    DROP POLICY IF EXISTS "holistic_analysis_delete_author" ON public.holistic_analysis_runs;
    CREATE POLICY "holistic_analysis_delete_author" ON public.holistic_analysis_runs FOR DELETE
      USING (
        work_id IN (
          SELECT w.id FROM public.works w
          JOIN public.users u ON w.author_id = u.id
          WHERE u.auth_id = auth.uid() AND u.deleted_at IS NULL
        )
      );
  END IF;
END $$;

-- ----- consume_nat: 탈퇴 계정 차단 -----
CREATE OR REPLACE FUNCTION public.consume_nat(
  p_amount integer,
  p_ref_type text DEFAULT NULL,
  p_ref_id bigint DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
  v_uid bigint;
  v_bal int;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT id, nat_balance INTO v_uid, v_bal
  FROM public.users
  WHERE auth_id = auth.uid() AND deleted_at IS NULL;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  IF COALESCE(v_bal, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_nat',
      'balance', COALESCE(v_bal, 0),
      'required', p_amount
    );
  END IF;

  UPDATE public.users
  SET nat_balance = nat_balance - p_amount
  WHERE id = v_uid AND nat_balance >= p_amount AND deleted_at IS NULL
  RETURNING nat_balance INTO v_new;

  IF v_new IS NULL THEN
    SELECT nat_balance INTO v_bal FROM public.users WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_nat',
      'balance', COALESCE(v_bal, 0),
      'required', p_amount
    );
  END IF;

  INSERT INTO public.nat_ledger (
    user_id, delta, balance_after, reason, ref_type, ref_id, metadata
  ) VALUES (
    v_uid,
    -p_amount,
    v_new,
    'analysis',
    p_ref_type,
    p_ref_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_nat(integer, text, bigint, jsonb) TO authenticated;
