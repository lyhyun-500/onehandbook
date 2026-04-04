# Supabase 마이그레이션 (CLI)

`supabase/migrations/` 에 `analysis_jobs` 등이 포함되어 있습니다.

1. [Supabase CLI](https://supabase.com/docs/guides/cli) 설치
2. 프로젝트 연결: `supabase link --project-ref <NEXT_PUBLIC_SUPABASE_URL의 서브도메인>`
3. 원격 DB에 적용: `supabase db push`

또는 Dashboard → SQL Editor 에서 루트의 `supabase-migration-RUN-ALL.sql` 또는 `supabase-migration-analysis-jobs.sql` 을 실행해도 됩니다.
