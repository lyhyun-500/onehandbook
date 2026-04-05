# Novel Agent — 구현 현황

> Next.js 앱: `onehandbook/`  
> **블록체인·IPFS는 MVP 범위 밖.** 확장 단계 과제로 [README 로드맵](../README.md)에 정리됨.  
> 작업 우선순위·일정은 [BACKLOG.md](./BACKLOG.md)에서 관리합니다.

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프론트 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| 백엔드·DB | Supabase (PostgreSQL, Auth, RLS) |
| 클라이언트 | `@supabase/supabase-js`, `@supabase/ssr` |
| AI (서버 전용) | `@anthropic-ai/sdk` — **원고 분석은 전부 Claude** (`claude-sonnet-4-5`). `@google/generative-ai`는 레지스트리·확장용으로 남아 있을 수 있음. `src/lib/ai/`, `POST /api/analyze` |

### AI 분석 프로필

- **`src/config/analysis-profiles.ts`**: `kakao-page`, `munpia`, `naver-series`, `generic`(범용). 모두 동일 `provider`/`model`, 차이는 `prompts/analysis/platforms/{id}.md` 로딩.
- **`prompts/analysis/base-system.md`**: 공통 시스템 지침(편집자 기준 냉정 평가, 90점 이상은 즉시 연재 가능 수준 등).
- `runAnalysis` — **서버**에서만 호출. API 키는 클라이언트에 노출하지 않음.
- 레거시 `agent_version` 문자열은 `LEGACY_AGENT_VERSION_ALIASES`로 현재 프로필 id에 매핑.

### 원고 글자 수 (분석 전)

- `src/lib/manuscriptEligibility.ts`: `MIN_ANALYSIS_CHARS=500`, `MIN_COMFORT_CHARS=1000`, 티어 `blocked | low | ok`.
- UI: `AnalyzePanel`, `WorkAnalysisHub` — 500 미만 비활성·안내, 500~1000 경고 모달(`ManuscriptLowVolumeModal`).
- API: 본문이 500자 미만이면 **400** `code: MANUSCRIPT_TOO_SHORT`.

---

## 인증

- Supabase Auth: **이메일·비밀번호**, **Google·Kakao OAuth** (`/login`). Supabase 대시보드 **Authentication → Providers** 에서 Google·Kakao 활성화, **URL Configuration → Redirect URLs** 에 `{배포URL}/auth/callback`(로컬은 `http://localhost:3000/auth/callback`) 추가.
- **네이버 OAuth (선택):** `GET /api/auth/naver/start` → 네이버 동의 → `GET /auth/callback/naver`. 서버 env **`NAVER_CLIENT_ID`**, **`NAVER_CLIENT_SECRET`** 필수(프로덕션은 **Vercel**에도 동일 키). 없을 때는 JSON으로 “설정되지 않았습니다” 응답. 비노출은 `NAVER_LOGIN_ENABLED=false` 또는 `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=false` (`src/lib/config/naverLogin.ts`).
- **OAuth `redirectTo` (로컬):** `src/lib/oauthCallbackOrigin.ts` — 요청 Host가 localhost·127.0.0.1 등이면 **`NEXT_PUBLIC_SITE_URL`을 쓰지 않고** 현재 origin으로 콜백 URL을 만듦(로컬에서 프로덕션 URL로 잘못 돌아가는 문제 완화).
- **휴대폰 인증 (CoolSMS / SOLAPI)**: 마이그레이션 `supabase-migration-phone-auth.sql` — `users.phone_e164`, `phone_verified_at`, `phone_verification_bonus_granted_at`, 테이블 `sms_otp_challenges`. 서버 env: `COOLSMS_API_KEY`, `COOLSMS_API_SECRET`, `COOLSMS_FROM`, **`SMS_OTP_SECRET`**(32자 이상 권장, OTP 해시용). 로컬만 `COOLSMS_MOCK=1` 이면 문자 미발송·콘솔 로그. API: `POST /api/auth/sms/send`, `POST /api/auth/sms/verify`. **최초 인증 성공 시 NAT +30** 1회(`phone_verification_bonus_granted_at`). **인증 완료된 번호**는 DB unique로 **번호당 계정 1개**만.
- `AppUser.phone_verified` — 미인증 시 `POST /api/analyze` **403** `PHONE_NOT_VERIFIED`, 분석 UI 비활성화.
- 로그인 성공 시 기본 `/dashboard`. OAuth 이메일 없음 시 `users.email`에 `{provider}_{authId}@oauth.novelagent.local` 형태로 저장.
- 미로그인 시 `/dashboard`, `/works/*`, **`/billing`**, **`/verify-phone`** → `/login` (middleware)
- `/`, `/login`, `/terms` 는 비로그인 접근 가능. **`/explore` 및 하위 경로는 `/`로 리다이렉트** (1차 개인용 툴)
- `POST /auth/signout`, `GET /auth/callback`
- **회원 탈퇴:** 헤더 사이드 메뉴 → 모달에서 확인 문구 입력 → **`POST /api/account/withdraw`**. 서버에서 작품·연쇄 데이터 정리, Supabase Auth 사용자 삭제, `public.users`는 **`deleted_at` 등으로 소프트 삭제**(닉네임 등 비식별 처리). **`SUPABASE_SERVICE_ROLE_KEY`** 필요. 스키마: `supabase-migration-users-deleted-at.sql` 또는 `supabase/migrations/20260405143000_users_deleted_at_withdrawal.sql`. 탈퇴·로그아웃 후 쿠키 정리는 `src/lib/supabase/authPersistence.ts` 등과 연동.

---

## 데이터베이스

| 테이블 | 용도 |
|--------|------|
| `users` | 작가 프로필 (`auth_id`), **`nat_balance`**, 휴대폰(`phone_e164`, `phone_verified_at`, `phone_verification_bonus_granted_at`) |
| `sms_otp_challenges` | SMS 인증번호 챌린지(해시만 저장) |
| `works` | 작품 |
| `episodes` | 회차(제품 용어 chapter) — `content_hash`(원고 MD5), `updated_at` |
| `reader_actions` | 독자 읽기 로그 (로그인 시 회차 읽기 기록) |
| `analysis_runs` | 회차별 AI 분석 결과 JSON, **`nat_cost`**, **`options_json`** |
| `analysis_results` | 회차별 분석 **캐시**(스냅샷): `score`, `feedback`(JSON 문자열), `nat_consumed`, `content_hash`, `analyzed_at`, `analysis_run_id` FK. 제품 구조: works → **episodes**(회차=챕터) → `analysis_results` |
| `payments` | 결제·충전 주문 (`provider`, `external_id`, `status`, `amount_krw`, `nat_amount`, 환불 대조용) |
| `nat_ledger` | NAT **입출금 원장**(append-only): `delta`, `balance_after`, `reason`, `ref_type`/`ref_id` |

**마이그레이션 (의존 순서 권장):**  
`supabase-migration-dashboard.sql` → `supabase-migration-episodes.sql` → `supabase-migration-explore.sql` → **`supabase-migration-analysis.sql`** → **`supabase-migration-analysis-public.sql`** (탐색·대시보드에서 `analysis_runs` 공개 집계용 SELECT) → **`supabase-migration-nat.sql`** (NAT·`consume_nat`·`analysis_runs` 확장) → **`supabase-migration-analysis-results.sql`** (`analysis_results` 캐시·RLS) → **`supabase-migration-phone-auth.sql`** (휴대폰 인증) → **`supabase-migration-payments-nat-ledger.sql`** (`payments`, `nat_ledger`, `consume_nat` 확장·`credit_nat` 서비스 롤) → **`supabase-migration-content-hash.sql`** (원고 MD5·재분석 확인).

- `POST /api/analyze` 성공 시 `analysis_runs` 저장·NAT 차감 후 **`analysis_results`에 한 행 추가**. 재분석 시 직전 캐시를 `previousResult`로 응답해 `AnalyzePanel`에서 비교 UI 표시.  
참고 스키마: 루트 `schema-supabase.sql`.

---

## Agent Score (UI)

- **대시보드** 등에 표시하는 숫자는 (탐색 UI 비활성 시에도 동일 계산 로직 사용) `reader_actions`가 아니라, 해당 작품에서 **AI 분석이 한 번이라도 저장된 회차**마다 최신 1건의 `overall_score`를 모은 **산술 평균**(반올림)입니다. 분석이 없으면 **—**.
- 계산: `onehandbook/src/lib/analysisSummary.ts` 의 `agentScoreFromAnalysisRuns` / `agentScoresByWorkFromRuns`
- 과거 `reader_actions` 기반 집계는 `oracle.ts`의 `computeOracleScores`에 남아 있으나, 위 화면에서는 사용하지 않습니다.

---

## 라우트

| 경로 | 접근 | 설명 |
|------|------|------|
| `/` | 전체 | 랜딩(히어로), 카피는 `src/app/page.tsx`(운영·검수 일정에 맞춰 조정) |
| `/explore/*` | — | **1차 비활성** — 미들웨어가 `/`로 리다이렉트(코드는 남김) |
| `/login` | 공개 | 로그인·회원가입 |
| `/dashboard` | 로그인 | 내 작품만 |
| `/works/*` | 로그인 | 작가용 작품·회차 관리 |
| `/works/[id]/analysis` | 로그인 | 회차별 AI 분석·**NAT** 확인 모달·일괄 분석 |
| `/billing` | 로그인 | NAT 잔액·충전 안내(유료 연동 전) |

---

## NAT (크레딧)

- 소모 규칙·옵션: 루트 **README**, 구현 `onehandbook/src/lib/nat.ts`
- 차감: Supabase RPC **`consume_nat`** — 분석 시 `nat_ledger`에 행 기록(`supabase-migration-payments-nat-ledger.sql` 또는 `supabase-migration-RUN-ALL.sql` 11번 구간)
- **캐시**: 현재 원고 `content_hash`와 **`analysis_runs.agent_version`(프로필 id)** 가 동일한 기존 행이 있으면 API·NAT 없이 저장 결과만 반환(`cached: true`). `force: true`는 캐시·409 모두 무시
- Claude: `completeAnthropic`에서 **`temperature: 0`**
- 충전·환불 등 적립: RPC **`credit_nat`** ( **`service_role` 전용** — Edge Function·서버에서 서비스 키로 호출)
- API: `POST /api/analyze` — 성공 저장 후 차감, 실패 시 삽입 롤백. 잔액 부족 **402** `INSUFFICIENT_NAT`, 원고 과소 **400** `MANUSCRIPT_TOO_SHORT`

---

## 환경 변수

`onehandbook/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, 분석용 **`ANTHROPIC_API_KEY`** (필수). `GOOGLE_GENERATIVE_AI_API_KEY`는 선택(레거시·확장 코드 경로용).  
**네이버 로그인:** `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`. **회원 탈퇴·서비스 롤 작업:** `SUPABASE_SERVICE_ROLE_KEY` (클라이언트에 노출 금지). 배포 시 `docs/VERCEL-ENV.md` 참고.

---

## 미구현 / 주의

**MVP 로드맵 (우선)**

- NAT **유료 충전·웹훅** (`/billing`은 placeholder)
- 독자 행동 기반 별도 지표(정주행률 가중 등) — `reader_actions` 활용

**보안·운영 (검토 권장)**

- RLS 아래 **`users` UPDATE**로 `nat_balance`를 직접 올리는 클라이언트 호출 가능 여부 — 운영 시 컬럼 제한·서비스 롤 전용 충전 API 등으로 보강 검토
- `POST /api/analyze` **레이트 리밋**(남용·비용 방지)

**확장 단계 (체인·저장소)**

- 블록체인, IPFS, D2F·토큰·정산 — README **확장** 섹션과 동일하게 **MVP 이후**에 진행
