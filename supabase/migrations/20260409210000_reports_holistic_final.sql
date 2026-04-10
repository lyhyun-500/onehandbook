-- reports 테이블 재정의: 최종 완성된 "통합 리포트" 전용
-- 기존(트렌드 원문용) reports는 legacy로 이름 변경 후 새 reports 생성

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reports'
  ) THEN
    -- 이미 legacy로 바뀐 적이 있으면 스킵
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trend_reports_legacy'
    ) THEN
      ALTER TABLE public.reports RENAME TO trend_reports_legacy;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_id bigint NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  holistic_run_id bigint REFERENCES public.holistic_analysis_runs(id) ON DELETE SET NULL,
  title text,
  body text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rag_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reports IS
  '최종 완성된 통합 분석 리포트(작가용). trends는 원문/근거 데이터, reports는 최종 결과물 저장';

CREATE INDEX IF NOT EXISTS idx_reports_user_created
  ON public.reports (app_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_work_created
  ON public.reports (work_id, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated
  USING (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    app_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

