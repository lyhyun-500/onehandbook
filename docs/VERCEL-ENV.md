# Vercel 환경 변수

Vercel 대시보드에는 **자동으로 `.env.local`이 올라가지 않습니다.**  
`docs/vercel-env-template.env`에 키 목록을 두었으니, 값만 로컬 `.env.local`과 맞춰 **Project → Settings → Environment Variables**에 넣으면 됩니다.

## 우선순위

| 구분 | 변수 | 설명 |
| --- | --- | --- |
| 필수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 연결 |
| 강력 권장 | `NEXT_PUBLIC_SITE_URL` | 프로덕션 URL (`https://…vercel.app` 또는 커스텀 도메인). OAuth·내부 호출 기준 |
| 거의 필수 | `ANALYZE_PROCESS_SECRET` | 비동기 분석 `POST /api/analyze/process` 보호. 없으면 해당 경로가 동작하지 않음 |
| 기능별 | `ANTHROPIC_API_KEY` | AI 분석 |
| 선택 | `UPSTASH_*` | 분석 레이트 리밋(프로덕션). 없으면 경고만 |
| 선택 | `SENTRY_DSN` 등 | 에러 추적·(빌드 시) 소스맵 |
| 선택 | `COOLSMS_*`, `SMS_OTP_SECRET` | 휴대폰 인증 |
| 선택 | `NEXT_PUBLIC_CONTACT_EMAIL` | 비우면 앱 기본 문의 메일 사용 |

## 적용 범위

- **Production**에는 위 값을 넣는 것이 일반적입니다.
- **Preview**(PR 배포)에서도 로그인·분석을 쓰려면 Preview에도 같은 키를 넣거나, Preview 전용 Supabase/키를 따로 둘 수 있습니다.

## 일괄 입력

Vercel UI에서 환경 변수를 여러 개 추가할 때, `vercel-env-template.env`를 열어 키 이름을 복사하고 값만 로컬에서 채워 넣으면 됩니다.
