# Novel Agent — CLAUDE.md

> 이 파일은 **웹 Claude (대화용)** 와 **Claude Code (터미널 에이전트)** 가 모두 참고하는 프로젝트 컨텍스트 파일.
> 섹션별 독자가 명시되어 있으니 각 도구가 자기 섹션 위주로 참고할 것.

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

## 주요 DB 테이블 (공통)
- `works`: 작품 (소프트 딜리트: deleted_at)
- `episodes`: 회차
- `episode_memos`: 회차별 메모 (사이드 패널)
- `analysis_jobs`: 분석 파이프라인 비동기 작업
- `analysis_runs`: 회차별 분석 결과
- `holistic_analysis_runs`: 통합(일괄) 분석 결과
- `notifications`: 알림
- `account_withdrawals`: 탈퇴 로그
- `training_logs`: Ollama 파인튜닝 대비 학습 데이터
- `users`: 사용자 정보 (auth_id, NAT 잔량 등)

## 비즈니스 모델 (공통)
- **NAT (Novel Agent Token)** 크레딧 기반 과금
- 베타: 무료, 주 3 NAT
- 스탠다드: 9,900원/월, 100 NAT
- NAT 추가 구매: 50 NAT 4,900원 / 100 NAT 8,900원 / 200 NAT 15,900원
- 글자수별 NAT 차등 소모: 3,000자 이하 1NAT / ~6,000자 2NAT / ~10,000자 3NAT / 옵션 +1NAT씩

> 자세한 결정 배경은 `docs/adr/ADR-0001-nat-token-model.md` 참조

---

## 📍 작업 도메인별 안내 (중요)

이 프로젝트는 **두 개의 작업 도메인** 으로 나뉘어 있음:

### 도메인 A: 소비자 사이트 (사용자 작가 대상)
- **담당 도구**: Cursor + 웹 Claude (대화)
- **경로**: `onehandbook/src/app/(main)/*`, `onehandbook/src/app/studio/*` 등
- **현재 작업**: 사이드 패널 UI 리디자인 스프린트 (Phase 2)
- **참고 문서**: 이 파일의 서비스 개요 + `docs/adr/`

### 도메인 B: 어드민 페이지 (LEE 운영 전용)
- **담당 도구**: **Claude Code** (자율 에이전트)
- **경로**: `onehandbook/src/app/admin/*` (신규 구축)
- **현재 작업**: MVP 구축 (유저 관리, NAT 충전, 문의 답장, 탈퇴 로그)
- **참고 문서**: **`docs/admin-handoff/` 폴더 전체**

> **Claude Code 는 도메인 B 작업 시 `docs/admin-handoff/README.md` 를 먼저 읽고 시작할 것.**

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

## 인증/로그인 (공통)
- Google 소셜 로그인
- Naver 소셜 로그인 (검수 완료, `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=true`)
- 최초 가입 시 약관 동의 모달 (필수: 이용약관, 개인정보처리방침 / 선택: 마케팅)
- `users` 테이블: `terms_agreed_at`, `privacy_agreed_at`, `marketing_agreed`, `login_provider`

## 장르 (공통)
로맨스 / 판타지 / 무협 / 현대물 / 스포츠

## 주요 페이지 (소비자 사이트)
- `/` : 메인 랜딩
- `/login` : 소셜 로그인
- `/studio` : 작가 대시보드
- `/studio/[workId]` : 작품 상세
- `/studio/[workId]/analysis` : AI 분석
- `/pricing` : 요금 안내
- `/terms` / `/privacy` / `/refund` : 약관/정책

## 주요 페이지 (어드민 — 구축 예정)
- `/admin` : 어드민 대시보드 (진입점)
- `/admin/users` : 유저 목록/검색/상세
- `/admin/users/[id]` : 유저 상세 + NAT 충전/차감
- `/admin/inquiries` : 1:1 문의 목록 + 답장 상태
- `/admin/withdrawals` : 탈퇴 로그

> 상세: `docs/admin-handoff/03-tech-spec.md`

## UX/알림 시스템 (소비자 사이트)
- 분석 백그라운드 처리 (전체화면 로딩 없음)
- 헤더 벨 아이콘: 메가커피 스타일 알림 드롭다운
- Supabase Realtime 구독
- 분석 중 배지: 회차/작품 목록에 파란색 pulse 뱃지

## 현재 구현된 기능 (소비자 사이트)
- [x] 작품 등록/수정/삭제 (소프트 딜리트)
- [x] 회차 등록/수정/삭제
- [x] 단일 회차 분석 / 일괄(통합) 분석
- [x] NAT 크레딧 시스템
- [x] 알림 시스템 (Realtime)
- [x] 회원 탈퇴 (소프트 딜리트 + 탈퇴 이유)
- [x] 1:1 문의 (Resend 메일 발송)
- [x] 네이버/구글 소셜 로그인
- [x] 사이드 패널 (세계관/인물/메모, Day 5 배포)

## 현재 작업 중

### 소비자 사이트
1. **사이드 패널 UI 리디자인 스프린트** (Phase 2 진행 중)
   - Phase 1: 색상 토큰 ✅ 커밋 완료
   - Phase 2-A: 인물 데이터 모델 확장 ✅ 빌드 통과, 커밋 대기
   - Phase 2-B: 작품설정 역할 옵션 동기화 (예정)
   - Phase 2-C: CharactersTab 분리 + 카드 재설계 (예정)
   - Phase 2-D: 시각 폴리싱 (예정)

### 어드민 (신규)
2. **어드민 MVP 구축** ← **Claude Code 전담**
   - `docs/admin-handoff/` 참조

### 그 외 예정
- Day 6 통합 저장 (ADR-0002 v2 설계 완료, 구현 대기)
- 연독률 계산 특수분석
- Paddle 결제 연동 (9월 사업자 등록 후)

## 환경변수 (주요)
- `NEXT_PUBLIC_NAVER_LOGIN_ENABLED` : 네이버 로그인 활성화
- `NEXT_PUBLIC_SITE_URL` : 사이트 URL (로컬/라이브 분기)
- `RESEND_API_KEY` : Resend 메일 API
- `RESEND_FROM` : `Novel Agent <noreply@novelagent.kr>`
- `INQUIRY_TO_EMAIL` : `agent@novelagent.kr`
- `ADMIN_EMAILS` (예정): 어드민 접근 허용 이메일 (쉼표 구분)

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
1. **어드민 페이지 작업만 담당**. 소비자 사이트 코드 (`onehandbook/src/app/(main)`, `/studio`, `/pricing` 등) 는 **수정 금지**.
2. **파일 수정 전 `git status` 확인**. 다른 도구 (Cursor) 가 작업 중인 파일 건드리지 말 것.
3. **큰 변경 전 계획 제시**. 5개 이상 파일 신규/수정 시 먼저 계획 보고 후 승인 대기.
4. **테스트/빌드 확인 필수**. 작업 단위 완료 시 `npm run build` 로 회귀 없는지 검증.
5. **보고 습관**. 각 작업 단위 끝에 "무엇을 했고, 다음에 뭘 할지" 요약.

### 참고 문서 우선순위
1. `docs/admin-handoff/README.md` ← **반드시 먼저 읽기**
2. `docs/admin-handoff/01-context.md` ← 왜 어드민을 만드는지
3. `docs/admin-handoff/02-requirements.md` ← 기능 명세 (MVP)
4. `docs/admin-handoff/03-tech-spec.md` ← 라우트/DB/권한/API
5. `docs/admin-handoff/04-ui-guide.md` ← UI 패턴
6. `docs/admin-handoff/codebase-map.md` ← 기존 코드 지도
7. `docs/adr/ADR-0003-admin-route.md` ← 어드민 위치 결정

### 건드리면 안 되는 곳 (중요)
- `onehandbook/src/app/(main)/**` — 소비자 랜딩/스튜디오
- `onehandbook/src/app/api/analyze/**` — 분석 파이프라인
- `onehandbook/src/components/side-panel/**` — Cursor 가 작업 중 (Phase 2)
- `supabase/migrations/*` 기존 파일 — 새 마이그레이션은 **추가만** (기존 수정 금지)
- `.env`, `.env.local` — 환경변수 직접 수정 금지 (LEE 가 수동 관리)

### 권장 작업 흐름

1.작업 착수 전 → 관련 admin-handoff 문서 읽기
2.git status 확인
3.계획 요약 (파일 목록 + 변경 내용)
4.승인 대기 (LEE 확인)
5.구현
6.빌드 검증
7. 작업 보고 + 다음 단계 제안
### 금지 동작
- `git push` 자동 실행 금지 (LEE 가 확인 후 지시)
- 기존 DB 테이블 구조 변경 금지 (신규 테이블 추가만 허용)
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
