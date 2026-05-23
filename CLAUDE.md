# Novel Agent — CLAUDE.md

> 이 파일은 **웹 Claude (대화용)** 와 **Claude Code (터미널 에이전트)** 가 모두 참고하는 프로젝트 컨텍스트 파일.
> 섹션별 독자가 명시되어 있으니 각 도구가 자기 섹션 위주로 참고할 것.
>
> 마지막 갱신: 2026-05-23 (Phase 2-D-9 inquiries 영속화 + 2026-05 사실 정합)

---

## 서비스 개요 (공통)

- **서비스명**: Novel Agent
- **URL**: novelagent.kr (라이브 운영 중)
- **설명**: 웹소설 작가를 위한 AI 흥행 가능성 분석 SaaS
- **이메일**: agent@novelagent.kr
- **GitHub**: lyhyun-500/onehandbook
- **운영자**: LEE (1인 운영, 비개발자 배경, 바이브 코딩)

## 기술 스택 (공통)
- **프론트**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **백엔드**: Supabase (Auth, Postgres, RLS, Realtime)
- **AI**: Claude (Anthropic), Gemini (Google), 프로바이더 추상화
- **RAG**: ChromaDB + 임베딩 (장르 트렌드)
- **인프라**: Vercel 배포, Resend 메일, 멀티 환경 분리

## DB 사실 (2026-05 측정, 공통)

### 정량 사실
- public 테이블: **31**
- RLS 정책: **61** (커버리지 **91%**)
- 함수: **15**
- trigger: **5**
- Storage bucket: **0** (작품 텍스트는 DB 직접 저장)

### 주요 테이블
- `users`: 사용자 (auth_id / **coin_balance** = NAT 잔량 / phone_verified / terms_agreed_at / privacy_agreed_at / marketing_agreed / login_provider / onboarding_seen_at / deleted_at)
- `works`: 작품 (소프트 딜리트: `deleted_at`)
- `episodes`: 회차
- `episode_memos`: 회차별 메모 (사이드 패널)
- `analysis_jobs`: 분석 파이프라인 비동기 작업 (status CHECK = pending/processing/completed/failed)
- `analysis_runs` / `analysis_results`: 회차별 분석 결과
- `holistic_analysis_runs`: 통합(일괄) 분석 결과
- `notifications`: 알림 (Realtime 구독)
- `coin_logs`: NAT 차감/적립 audit ledger
- `account_withdrawals`: 탈퇴 로그
- `inquiries`: 1:1 문의 (category enum 6값 + closed_at, ADR-0008)
- `training_logs`: Ollama 파인튜닝 대비 학습 데이터

### NAT RPC 3건
- `consume_nat(p_user_id, p_amount, ...)` — 차감
- `credit_nat(p_user_id, p_amount, p_reason, p_ref_type, p_ref_id, p_metadata, p_expires_at, ...)` — 적립
  - `p_reason` allowlist 6값: `purchase_credit / refund / bonus / admin_adjust / manual_adjust / other`
- `admin_debit_nat(p_user_id, p_amount, p_admin_reason, p_admin_auth_id, p_metadata)` — 어드민 수동 차감 (pronargs=5)

## 비즈니스 모델 (공통)
- **NAT (Novel Agent Token)** 크레딧 기반 과금
- 베타: 무료, 주 3 NAT
- 스탠다드: 9,900원/월, 100 NAT
- NAT 추가 구매: 50 NAT 4,900원 / 100 NAT 8,900원 / 200 NAT 15,900원

### NAT 차감 룰 (단일 회차 분석)
- 6,000자 이하 = **1 NAT**
- 6,001~10,000자 = **2 NAT**
- 10,001자 이상 = **3 NAT**
- **세계관·인물 설정 = 기본 포함 (무료, 옵션 부재)**
- 플랫폼 최적화 (카카오·문피아·네이버) = **+1 NAT 옵션 only**

> **운영 코드 갭 사실**: `lib/nat.ts:36-42` `computeNatCost` 가 `includeLore` true 시 `+1` 가산 잔재. `parseNatOptions` 기본값 = `true` → 자동 +1 가산 동작. **본 사양 (세계관 기본 포함 무료) 정합 위해 별도 라운드 정정 대상**.

> 자세한 결정 배경은 `docs/adr/ADR-0001-nat-token-model.md` 참조

---

## 📍 작업 도메인별 안내 (중요)

이 프로젝트는 **두 개의 작업 도메인** 으로 나뉘어 있음:

### 도메인 A: 소비자 사이트 (사용자 작가 대상)
- **담당 도구**: **Claude Code** (코드 작업) + 웹 Claude (PM/설계 자문)
- **경로**: `onehandbook/src/app/(app)/*`, `onehandbook/src/app/(main)/*` 등
- **현재 작업**: 디자인 시안 적용 스프린트 (Phase 2-D)
- **참고 문서**: 이 파일의 서비스 개요 + `docs/adr/` + `design_novel/novel-agent/`

### 도메인 B: 어드민 페이지 (LEE 운영 전용)
- **담당 도구**: **Claude Code** (자율 에이전트)
- **경로**: `onehandbook/src/app/admin/*` (구축 완료)
- **현재 작업**: 유저 관리, NAT 충전/차감, 문의 답장, 탈퇴 로그
- **참고 문서**: **`docs/admin-handoff/` 폴더 전체**

> **Claude Code 는 도메인 A/B 모든 코드 작업을 단독 담당.** 도메인 B 작업 시 `docs/admin-handoff/README.md` 를 먼저 읽고 시작할 것.

---

## 분석 구조 (공통)
- **단일 회차 분석**: 회차 1개, 글자수 기준 NAT 소모
- **일괄(통합) 분석**: 다회차 선택, 10화 단위 청크 배치 처리
  - 청크별 개별 분석 + 통합 리포트 동시 생성
  - `parent_job_id`로 연결
  - 최대 50화 제한 (Vercel 타임아웃 대응)
- **분석 파이프라인**: `/api/analyze` (작업 생성) → `/api/analyze/process` (LLM 실행 분리)
- **pending 하드 만료**: 12분
- **워커 maxDuration**: 300초 (내부 상한 600~800초)

### `/api/analyze` 응답 사양
- 응답 = **snake_case**: `job_id / required_nat / breakdown / balance / status`
- NAT 부족 = **402 `INSUFFICIENT_NAT`** + `required / balance / breakdown`
- 캐시 충돌 = 409 `CACHED_ANALYSIS_AVAILABLE`
- 분량 부족 = 400 `MANUSCRIPT_TOO_SHORT` (500자 미만)
- 휴대폰 미인증 = 403 `PHONE_NOT_VERIFIED`
- 진행 중 충돌 = 409 `EPISODE_ANALYSIS_IN_PROGRESS`
- `analysis_jobs.status` CHECK 4값: `pending / processing / completed / failed`

## 분석 도메인 6축 (공통)
신규 분석은 **한글 키 직접 사용** (프롬프트 유도):
1. **첫 훅·몰입**
2. **인물 매력**
3. **세계관**
4. **긴장감**
5. **로맨스·감정선**
6. **독창성**

- 운영 코드: `src/lib/analysis/dimensionLabel.ts`
- `EN_TO_KO` 매핑 **19개** = 영어 호환용 잔존 (deprecated, 과거 분석 JSON snake_case 키 → 한글 변환). 신규 분석에는 사용하지 않음.

## 인증/로그인 (공통)
- Google 소셜 로그인
- Naver 소셜 로그인 (검수 완료, `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=true`)
- **이메일·비밀번호 로그인 = 제거됨** (소셜 only)
- 최초 가입 시 약관 동의 모달 (필수: 이용약관, 개인정보처리방침 / 선택: 마케팅)
- `users` 테이블: `terms_agreed_at`, `privacy_agreed_at`, `marketing_agreed`, `login_provider`, `onboarding_seen_at`

## 장르 (공통)
로맨스 / 판타지 / 무협 / 현대물 / 스포츠

## 주요 페이지 (소비자 사이트)
- `/` : 메인 랜딩
- `/login` : 소셜 로그인
- `/studio` : 작가 대시보드
- `/works/[id]` : 작품 상세 (이전 `/studio/[workId]` 에서 마이그레이션)
- `/works/[id]/analysis` : 분석 동선 (개별 + 일괄 통합)
- `/works/[id]/episodes/[episodeId]` : 회차 분석
- `/works/[id]/episodes/[episodeId]/edit` : 회차 편집
- `/works/[id]/episodes/new` : 회차 신규 등록
- `/works/[id]/settings` : 작품 설정
- `/account/inquiries` : 1:1 문의함 (Phase 2-D-9, 2-pane + 중앙 모달)
- `/guide` : 사용 가이드 (4 섹션)
- `/sample` : 비로그인 샘플 분석
- `/onboarding` : 신규 가입자 온보딩 풀스크린
- `/pricing` : 요금 안내
- `/terms` / `/privacy` / `/refund` : 약관/정책

## 주요 페이지 (어드민)
- `/admin` : 어드민 대시보드 (진입점)
- `/admin/users` : 유저 목록/검색/상세
- `/admin/users/[id]` : 유저 상세 + NAT 충전/차감
- `/admin/inquiries` : 1:1 문의 목록 + 답장
- `/admin/withdrawals` : 탈퇴 로그

> 상세: `docs/admin-handoff/03-tech-spec.md`

## UX/알림 시스템 (소비자 사이트)
- 분석 백그라운드 처리 (전체화면 로딩 없음)
- 헤더 벨 아이콘: 메가커피 스타일 알림 드롭다운
- Supabase Realtime 구독
- 분석 중 배지: 회차/작품 목록에 파란색 pulse 뱃지

## 1:1 문의 (Phase 2-D-9 영속화)
- **ADR-0008**: Resend 메일 발송 → DB INSERT + 사이트 알림 자동 발송
- 어드민이 `/admin/inquiries` 에서 답변 작성 → `notifications` 자동 insert (`type: "inquiry_reply"`)
- `inquiries.category` enum 6값: `billing / analysis / bug / account / feature / etc`
- `closed_at` column + **3-state derive**: `waiting (reply_content null) / answered (reply_content not null + closed_at null) / closed (closed_at not null)`
- **single-turn**: `content` (사용자 1건) ↔ `reply_content` (운영팀 1건) 1:1 매핑
- 사용자 페이지 (`/account/inquiries`) = **2-pane layout** (list + thread panel) + 「+ 문의하기」 **중앙 모달** (overlay + dim + ESC/X/배경 클릭 close)
- **FAB 폐기** (사이트 전역 FloatingInquiryButton 마운트 제거)
- RLS UPDATE policy `Users can close own inquiries` + column GRANT (`UPDATE (closed_at) TO authenticated`)
- 사용자 본인 close = `POST /api/account/inquiries/[id]/close`
- 「추가 질문」 = 신규 inquiry 작성 (현 thread category prefill)

## 현재 구현된 기능 (소비자 사이트)
- [x] 작품 등록/수정/삭제 (소프트 딜리트)
- [x] 회차 등록/수정/삭제
- [x] 단일 회차 분석 / 일괄(통합) 분석
- [x] NAT 크레딧 시스템 (3-tier + 플랫폼 옵션 +1)
- [x] 알림 시스템 (Realtime + 헤더 벨)
- [x] 회원 탈퇴 (소프트 딜리트 + 탈퇴 이유)
- [x] 1:1 문의 (DB INSERT + 사이트 알림 자동, Phase 2-D-9 모달/2-pane)
- [x] 네이버/구글 소셜 로그인 (이메일·비번 폐기)
- [x] 사이드 패널 (세계관/인물/메모)
- [x] 온보딩 (`/onboarding`, 1회 노출 + `users.onboarding_seen_at`)
- [x] 비로그인 샘플 분석 (`/sample`)
- [x] 사용 가이드 (`/guide`, 4 섹션)
- [x] 어드민 MVP (유저/NAT/문의/탈퇴)

## 현재 작업 상태

### Phase 2-D 시리즈 (디자인 시안 적용 스프린트)
- Phase 2-D-1 ~ 2-D-8 완료 (atom / studio / pricing / shell / works detail / episode / batch / analysis IA)
- **Phase 2-D-9 inquiries 재정비 완료** (5 commit: DB migration + 페이지/컴포넌트/API + FAB 폐기 + layout fixup + 모달/#id fixup)

### 누적 push 대기
- **20 commit 누적** (Phase 2-D 일괄 push 정책)
- branch: `feat/design-phase-2`
- LEE 시각 검증 통과 후 일괄 push 예정

### 다음 의제 (Phase 2-D-9 후속)
- **overflow 갭**: `(app)/layout` children wrapper `overflow-y-auto` ↔ 시안 `overflow-hidden` 갭 (사이트 전역 영향)
- **realtime**: composer 제출 후 list 자동 갱신 (Supabase Realtime 구독)
- **focus trap**: 모달 안 Tab 순환 (접근성)
- **unread derive**: notifications.read_at 또는 last_seen_at 추가
- **AnalysisFailed.onReport 활성화**: 분석 실패 시 「문의함에 신고」 동작 연결 (현재 호출자 0)

### 그 외 예정
- 연독률 계산 특수분석
- Paddle 결제 연동 (사업자 등록 후)

## 환경변수 (주요)

### 공개 OK
- `NEXT_PUBLIC_NAVER_LOGIN_ENABLED` : 네이버 로그인 활성화 플래그
- `NEXT_PUBLIC_SITE_URL` : 사이트 URL (로컬/라이브 분기)
- `NEXT_PUBLIC_SUPABASE_URL` : Supabase project URL (production: `ystxvlibeqdrlnsriidh.supabase.co`)
- `RESEND_FROM` : `Novel Agent <noreply@novelagent.kr>`
- `INQUIRY_TO_EMAIL` : `agent@novelagent.kr`

### 비공개 (`.env.local` only — 노출 금지)
- `SUPABASE_SERVICE_ROLE_KEY` : Supabase service role (DDL/admin RPC 호출용)
- `RESEND_API_KEY` : Resend 메일 API key
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` : Naver OAuth
- `ADMIN_EMAILS` : 어드민 접근 허용 이메일 (쉼표 구분)
- AI provider keys (Anthropic / Google)

### e2e Supabase 분기
- `E2E_SUPABASE_URL` : e2e project URL
- `E2E_SUPABASE_SERVICE_ROLE_KEY` : 비공개

## e2e 환경 (Supabase 분리)
- **project_ref**: `zejrznynbmnfatghisjq`
- **region**: aws-1-ap-southeast-2
- **tier**: Free
- **schema**: production 100% 동일
- **데이터**: 0건 (테스트 격리)
- **연결 사양**:
  - Direct connection = **IPv6 only** → **Session pooler URL 사용 필수**
  - Email magiclink only (OAuth 미설정)
- **schema 동기화 스크립트**: `scripts/replicate-supabase-schema.sh`

## schema 잔재 (deferred 정정 대상)
- **`withdrawal_logs ↔ account_withdrawals` 명칭 갭**:
  - 운영 코드 사실 = **`account_withdrawals` 단독 사용** (migration `20260409193000_account_withdrawals.sql` + 코드 grep 검증)
  - `withdrawal_logs` 코드 잔재 0
  - LEE 문서 표기 갭 = **차후 정정 대상** (코드 사실 우선)

## 주의사항 (공통)
- Vercel 서버리스 타임아웃: 단일 요청 최대 300초
- 일괄 분석 50화 초과 시 안내 문구 노출
- 비교 레퍼런스는 웹소설/웹툰 작품만 (드라마/영화 언급 금지)
- temperature: 0 고정 (분석 일관성)
- 500자 미만 분석 차단
- 소프트 딜리트 사용 (실제 삭제 안 함)

---

## 🤖 Claude Code 전용 가이드

이 섹션은 Claude Code (터미널 에이전트) 가 주로 참고.

### 작업 원칙
1. **소비자 사이트 + 어드민 페이지 전 코드 작업 담당** (도메인 A/B 단독). 명시 보호 영역(아래 "건드리면 안 되는 곳")만 예외.
2. **파일 수정 전 `git status` 확인**. 미커밋 변경/타 브랜치 작업 흔적은 본 채널에 먼저 보고.
3. **큰 변경 전 계획 제시**. 5개 이상 파일 신규/수정 시 먼저 계획 보고 후 승인 대기.
4. **테스트/빌드 확인 필수**. 작업 단위 완료 시 `npx tsc --noEmit` + `npm run build` 로 회귀 없는지 검증.
5. **보고 습관**. 각 작업 단위 끝에 "무엇을 했고, 다음에 뭘 할지" 요약.

### 참고 문서 우선순위
1. `docs/redesign/handoff-2026-05-23-phase-2-d-9-inquiries.md` ← **최신 진입 핸드오프 (Phase 2-D-9)**
2. `docs/admin-handoff/README.md` ← 어드민 작업 시 먼저
3. `docs/admin-handoff/01-context.md` ← 왜 어드민을 만드는지
4. `docs/admin-handoff/02-requirements.md` ← 기능 명세 (MVP)
5. `docs/admin-handoff/03-tech-spec.md` ← 라우트/DB/권한/API
6. `docs/admin-handoff/04-ui-guide.md` ← UI 패턴
7. `docs/admin-handoff/codebase-map.md` ← 기존 코드 지도
8. `docs/adr/ADR-0001-nat-token-model.md` ← NAT 모델 결정 배경
9. `docs/adr/ADR-0003-admin-route.md` ← 어드민 위치
10. `docs/adr/ADR-0008-notifications-unification.md` ← 1:1 문의 DB 전환 + 알림 통합 배경

### 건드리면 안 되는 곳 (중요)
- `onehandbook/src/app/api/analyze/**` — 분석 파이프라인 (운영 중, 신중)
- `supabase/migrations/*` 기존 파일 — 새 마이그레이션은 **추가만** (기존 수정 금지)
- `.env`, `.env.local` — 환경변수 직접 수정 금지 (LEE 가 수동 관리)

### DB 적용 권한 사실
- supabase CLI = 미설치
- psql = 설치됨 (PostgreSQL 18.3), 단 `DATABASE_URL` env 부재
- Supabase Management API = Personal Access Token 부재
- PostgREST = DDL 불가
- **유일 가능 path** = LEE Studio SQL Editor manual run

### 권장 작업 흐름

1. 작업 착수 전 → 관련 핸드오프/handoff/admin-handoff 문서 읽기
2. `git status` 확인
3. 계획 요약 (파일 목록 + 변경 내용)
4. 승인 대기 (LEE 확인)
5. 구현
6. 빌드 검증 (`npx tsc --noEmit` + `npm run build`)
7. 작업 보고 + 다음 단계 제안

### 본 채널 누적 게이트 10건 (영속화)
1. runtime 사실 검증 (코드 read ≠ runtime 동작)
2. 운영 main 브랜치 코드 검증 (`git show main:<path>`)
3. Supabase / external service 동작 (공식 문서 + 운영 사실)
4. 사용자 시각 보고 출처 검증 (운영? 로컬? feature? main?)
5. LEE 로컬 branch sync 검증
6. 추측 단정 금지 (LEE 결정 게이트 통과 전 단정 X)
7. 시안 정합 시각 검증 (LEE D-B 검증 통과 전 단정 不可)
8. 권한 사실 사전 점검 (DB / API 적용 권한)
9. DB schema ↔ 코드 변경 commit 분할 시간 갭 점검
10. 시안 mockup ↔ 실제 UX 사실 검증 (mockup 결함 가능성)

### 금지 동작
- `git push` 자동 실행 금지 (LEE 가 확인 후 지시)
- 기존 DB 테이블 구조 변경 금지 (신규 테이블 추가만 허용) — LEE 사양 명시 통과 예외
- 소비자 사이트 UI 톤 변경 금지
- 환경변수 값 변경 금지 (이름만 제안 가능)

---

## 📝 웹 Claude 전용 가이드

이 섹션은 웹 Claude (대화 모드, Cursor 연동) 가 주로 참고.

### 역할
- LEE 의 시니어 PM/PO 멘토 + 기술 자문
- Cursor 에게 넘길 지시서 작성
- 설계 의사결정 보조 (ADR, EV 분석)
- 포트폴리오 관점 피드백

### 스타일 원칙
- 워라밸/컨디션 체크 금지 (LEE 가 알아서 조절)
- 담백한 인정, 과도한 칭찬 지양
- 기술 용어 나오면 혼합형 설명 (인라인 정의 + 개념 블록)
- 본인 판단 묻는 질문은 `ask_user_input_v0` 사용

---

**End of CLAUDE.md**
