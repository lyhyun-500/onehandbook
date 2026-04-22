# Codebase Map — 기존 코드 지도

> Claude Code 가 기존 코드베이스를 탐색할 때 참고할 지도.
> **건드려야 할 곳 / 건드리면 안 되는 곳** 을 명확히 구분.

---

## 🗺️ 전체 구조
OHB/                            ← Git 루트
├── CLAUDE.md                   ← 프로젝트 컨텍스트 (이 파일의 상위)
├── docs/
│   ├── adr/                    ← 아키텍처 결정 기록
│   │   ├── README.md
│   │   ├── ADR-0001-nat-token-model.md
│   │   ├── ADR-0002-integrated-save.md
│   │   └── ADR-0003-admin-route.md   ← 어드민 위치 결정
│   └── admin-handoff/          ← 이 폴더
│       ├── README.md
│       ├── 01-context.md
│       ├── 02-requirements.md
│       ├── 03-tech-spec.md
│       ├── 04-ui-guide.md
│       └── codebase-map.md     ← 이 파일
├── onehandbook/                ← Next.js 앱 (실제 코드 여기)
│   ├── src/
│   ├── supabase/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── postcss.config.mjs
└── (기타)

**중요**:
- Git repo 루트는 `OHB/` (`.git` 이 여기 있음)
- Next.js 앱은 `onehandbook/` 서브디렉토리
- Git 명령은 `OHB/` 에서 실행 (또는 어디서든 상위 `.git` 찾아 올라감)

---

## 📁 onehandbook/src/ 상세

### app/ — Next.js App Router
onehandbook/src/app/
├── (main)/              ⛔ 건드리지 마 — 소비자 사이트 랜딩
│   ├── page.tsx         메인 랜딩
│   ├── pricing/
│   ├── terms/
│   ├── privacy/
│   └── refund/
│
├── login/               ⛔ 건드리지 마 — 로그인 페이지
│
├── studio/              ⛔ 건드리지 마 — 작가 스튜디오
│   ├── page.tsx         /studio
│   └── [workId]/
│       ├── page.tsx     작품 상세
│       └── episodes/
│           └── [episodeId]/
│               └── edit/
│                   └── page.tsx  회차 편집
│
├── api/                 API 라우트
│   ├── analyze/         ⛔ 건드리지 마 — 분석 파이프라인
│   ├── inquiries/       ⚠️ 참고 — 기존 문의 발송 API
│   ├── auth/            ⛔ 건드리지 마 — 인증 관련
│   └── admin/           ✅ 신규 생성할 곳
│
├── admin/               ✅ 신규 생성할 곳
│   └── (예정 파일들)
│
├── layout.tsx           ⚠️ 참고 — 루트 레이아웃
└── globals.css          ⚠️ 참고 — Tailwind v4 @theme 정의
(Phase 1 에서 --color-sidepanel-* 추가됨)
어드민용 --color-admin-* 추가 가능

### components/
onehandbook/src/components/
├── side-panel/          ⛔ Cursor 작업 중 (Phase 2) — 절대 건드리지 마
│   ├── SidePanel.tsx
│   ├── SidePanelWrapper.tsx
│   ├── SidePanelTabs.tsx
│   ├── SidePanelContent.tsx
│   ├── WorldviewTab.tsx
│   ├── CharactersTab.tsx
│   ├── MemoTab.tsx
│   ├── DeleteConfirmModal.tsx
│   ├── useSidePanelState.ts
│   ├── parseWorkJson.ts
│   ├── characterModel.ts
│   └── types.ts
│
├── TagInput.tsx         ⚠️ 참고 가능 (작은 공용 컴포넌트)
├── ManuscriptLowVolumeModal.tsx   ⚠️ 참고 — 모달 패턴
├── EpisodeEditForm.tsx  ⛔ 건드리지 마 (회차 편집)
│
└── admin/               ✅ 신규 생성할 곳
└── (예정 파일들)

### lib/
onehandbook/src/lib/
├── supabase/
│   ├── client.ts        ⚠️ 참고 — 클라이언트용 Supabase
│   ├── server.ts        ⚠️ 참고 — 서버용 Supabase
│   └── middleware.ts    ⚠️ 참고 — 미들웨어용
│
├── works/
│   ├── loreTypes.ts     ⚠️ 참고 — CHARACTER_ROLES 정의
│   └── (기타)
│
└── admin/               ✅ 신규 생성할 곳
├── requireAdmin.ts
├── queries.ts
└── types.ts

### middleware.ts

- 위치: `onehandbook/src/middleware.ts`
- **기존 파일 존재 여부 확인 필수**
  - 있으면: 기존 로직에 `/admin` 차단 **병합**
  - 없으면: 신규 작성
- **절대 기존 로직 덮어쓰지 말 것**

---

## 🗄️ supabase/migrations/
onehandbook/supabase/migrations/
├── (기존 마이그레이션 29+ 개)
└── (✅ 신규 추가할 곳)
├── 2026042X_add_admin_role.sql       role 컬럼 추가
└── 2026042X_create_nat_adjustments.sql  NAT 로그 테이블

**작성 규칙**:
- 파일명: `YYYYMMDDHHMMSS_snake_case.sql`
- **기존 파일 수정 금지** (신규만 추가)
- Supabase 대시보드에서 **LEE 가 수동 실행** (Claude Code 는 파일 작성만)
- `works`/`episode_memos` 패턴 복제 참고 (같은 폴더 기존 파일)

**기존 마이그레이션 주요 패턴** (참고용):
- RLS 정책 + GRANT 쌍으로 항상 같이 작성
- `authenticated` 역할에 GRANT 필수
- `auth.uid()` 와 `users.auth_id` 매핑 확인
- Bigserial 사용 시 시퀀스 GRANT 도 추가

---

## 🔑 주요 테이블 스키마 (요약)

Claude Code 가 쿼리 작성 시 참고.

### users
auth_id          UUID    (PK, Supabase auth 연결)
email            TEXT
nickname         TEXT
login_provider   TEXT    ('google' | 'naver')
nat_balance      INTEGER
created_at       TIMESTAMPTZ
deleted_at       TIMESTAMPTZ  (소프트 딜리트)
terms_agreed_at  TIMESTAMPTZ
privacy_agreed_at TIMESTAMPTZ
marketing_agreed BOOLEAN
role             TEXT    (✅ 추가 예정: 'user' | 'admin')

### works
id               UUID
user_id          UUID    (→ users.auth_id)
title            TEXT
genre            TEXT
world_setting    JSONB
character_settings JSONB (배열)
created_at       TIMESTAMPTZ
deleted_at       TIMESTAMPTZ

### episodes
id               UUID
work_id          UUID
episode_number   INT
title            TEXT
content          TEXT
word_count       INT
created_at       TIMESTAMPTZ
deleted_at       TIMESTAMPTZ

### analysis_jobs
id               UUID
user_id          UUID
work_id          UUID
episode_id       UUID    (nullable, 일괄은 null)
parent_job_id    UUID    (일괄 분석 연결)
status           TEXT    ('pending' | 'running' | 'completed' | 'failed')
nat_consumed     INT
created_at       TIMESTAMPTZ

### withdrawal_logs
id               BIGSERIAL
user_id          UUID
email            TEXT    (탈퇴 시점 스냅샷)
nickname         TEXT    (탈퇴 시점 스냅샷)
reason           TEXT
created_at       TIMESTAMPTZ

### inquiries
※ 존재 여부 확인 필요

migrations 폴더 스캔
있으면 schema 파악
없으면 신규 생성 (03-tech-spec.md §2.3 참고)


### notifications
id               BIGSERIAL
user_id          UUID
type             TEXT
message          TEXT
read_at          TIMESTAMPTZ
created_at       TIMESTAMPTZ

### training_logs
(Ollama 파인튜닝 대비, 어드민 MVP 에서는 사용 안 함)

---

## 🎨 스타일링 기존 패턴

### Tailwind v4
- `onehandbook/postcss.config.mjs` 에 `@tailwindcss/postcss` 플러그인
- `onehandbook/src/app/globals.css` 에 `@import "tailwindcss";`
- `@theme inline` 블록에 CSS 변수 (Phase 1 에서 추가됨)

### 네임스페이스
- `--color-sidepanel-*` : 사이드 패널 (Cursor 작업 중)
- `--color-role-*` : 인물 역할 뱃지
- `--color-admin-*` : ✅ 어드민 추가 가능

### 클래스 사용 패턴
```tsx
<div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
  <span className="text-sm text-gray-700">...</span>
</div>
```

- 인라인 색 `bg-[#...]` 지양 (토큰 또는 표준 Tailwind 색)
- `cn()` 유틸리티 사용 중 여부 확인 필요

---

## 📦 package.json 주요 의존성
Next.js 16.x
React 19.x
TypeScript
Tailwind CSS 4.x
@supabase/ssr (또는 @supabase/auth-helpers)
lucide-react (아이콘)

**신규 라이브러리 추가 시**:
- LEE 에게 "이거 추가 필요" 보고 후 승인
- 임의로 `npm install` 하지 마 (bundle size 영향)

---

## 🔍 탐색 명령어 (Claude Code 가 쓸 것)

### 파일 탐색
```bash
# 현재 구조 확인
ls onehandbook/src/app
ls onehandbook/src/components

# 특정 패턴 검색
grep -r "CHARACTER_ROLES" onehandbook/src
grep -r "createServerClient" onehandbook/src

# 마이그레이션 스캔
ls onehandbook/supabase/migrations/ | head -30
```

### 기존 패턴 학습
```bash
# Supabase 클라이언트 사용법 보기
cat onehandbook/src/lib/supabase/server.ts

# 기존 API 라우트 패턴
cat onehandbook/src/app/api/inquiries/*/route.ts

# 마이그레이션 스타일
cat onehandbook/supabase/migrations/*episode_memos*.sql
```

---

## ⛔ 절대 건드리지 마 (재강조)

### 파일/폴더
- `onehandbook/src/app/(main)/**`
- `onehandbook/src/app/studio/**`
- `onehandbook/src/app/api/analyze/**`
- `onehandbook/src/components/side-panel/**`  ← **Cursor 진행 중**
- `onehandbook/src/components/EpisodeEditForm.tsx`
- `.env`, `.env.local`, 환경변수 파일

### 작업
- `git push` 자동 실행
- 기존 마이그레이션 SQL 수정
- 기존 DB 테이블 컬럼 타입 변경
- Supabase 콘솔 직접 조작 (로컬 파일만 작성)

### 의심스러우면
- 수정 전 **LEE 에게 확인 질문**
- 불확실한 건 건드리지 말고 보고

---

## ✅ 자유롭게 작업 가능

### 파일/폴더 (신규 생성 OK)
- `onehandbook/src/app/admin/**`
- `onehandbook/src/app/api/admin/**`
- `onehandbook/src/components/admin/**`
- `onehandbook/src/lib/admin/**`
- `onehandbook/supabase/migrations/*admin*.sql`
- `onehandbook/supabase/migrations/*nat_adjust*.sql`

### 파일 (조건부 수정 가능)
- `onehandbook/src/middleware.ts` — **기존 로직 병합**, 덮어쓰기 금지
- `onehandbook/src/app/globals.css` — `@theme` 에 `--color-admin-*` 추가 가능

---

## 🚦 첫 작업 전 체크리스트

Claude Code 가 작업 시작 전 실행:

```bash
# 1. 현재 Git 상태 확인
cd /path/to/OHB
git status
git log --oneline -5

# 2. 작업 브랜치 확인 (main 에서 작업하는지)
git branch --show-current

# 3. onehandbook 위치 확인
cd onehandbook
npm run build  # 현재 상태로 빌드 성공 확인

# 4. 기존 미들웨어 있는지 확인
ls src/middleware.ts

# 5. inquiries 테이블 관련 파일 스캔
ls supabase/migrations/ | grep -i inquir
```

결과 공유 → 이해한 내용 요약 → LEE 승인 → 작업 시작.

---

**이제 모든 문서 읽음. 다음은 LEE 와 대화로 작업 범위 확정.**
