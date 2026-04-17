-- works: 소프트 딜리트 + 계약 관련 필드
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.works.deleted_at IS '작품 삭제 시각(소프트 딜리트). NULL이면 정상 작품';

CREATE INDEX IF NOT EXISTS idx_works_deleted_at
  ON public.works (deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT '미계약',
  ADD COLUMN IF NOT EXISTS management_offer_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.works.contract_status IS '계약 여부(미계약/계약)';
COMMENT ON COLUMN public.works.management_offer_opt_in IS '매니지먼트 계약 제의 수신 의사';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'works_contract_status_check'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_contract_status_check
      CHECK (contract_status IN ('미계약', '계약'));
  END IF;
END $$;

