# 디자인 개편 사전 진단 — Current State

> 디자인 전면 개편 작업 시작 전, 안전망(롤백·회귀 테스트·Feature flag) 구축을 위한 코드베이스 현황 진단.
> 진단 일자: 2026-05-08
> 진단 범위: read-only (코드 수정 없음)

---

## 1. Git 상태

| 항목 | 값 |
|---|---|
| 최신 main 커밋 SHA | `cdf5c99803a2e39cafcd398be5a823f193a4cdd3` |
| 커밋 메시지 | `fix(paddle): 모든 transaction.completed sync 처리 + ADR-0010 v3 + TS-003` (2026-05-07T15:22:51+09:00) |
| 최근 30일 커밋 수 | **106건** |
| 최근 30일 변경 파일 수 (unique) | **307개** |
| 태그 목록 | **(없음)** — 한 번도 tag 찍힌 적 없음 |
| 미커밋 변경 (uncommitted) | **(없음)** — `git status` clean |

### 개편 작업 시 영향도/조치 필요 사항
- **태그 0개**가 가장 큰 리스크. 롤백 기준점이 SHA 하나뿐이라 운영 중 "안전한 직전 버전" 식별이 어렵다 → **개편 시작 직전 baseline 태그(예: `v-pre-redesign-2026-05-08`) 찍기 필수**.
- 30일 106 commits로 main 직접 push가 일상화됨 → 개편 기간엔 별도 브랜치(`redesign/*`) 권장.

---

## 2. Feature Flag / 환경 토글 시스템 존재 여부

| 패턴 | 발견 여부 | 위치 |
|---|---|---|
| `process.env.NEXT_PUBLIC_*_ENABLED` | ✅ 1건 | `src/lib/config/naverLogin.ts:22, 37` — `NEXT_PUBLIC_NAVER_LOGIN_ENABLED` (네이버 로그인 검수 토글) |
| `process.env.NEXT_PUBLIC_FEATURE_*` | ❌ 없음 | — |
| `featureFlag` / `useFlag` 함수, `flag.ts`/`flags.ts` 파일 | ❌ 없음 | — |
| 쿼리스트링 토글 (`searchParams.get('newui')` 등) | ❌ 없음 | — |
| 쿠키 기반 토글 | ❌ 없음 | — |
| 외부 SaaS (LaunchDarkly, Unleash, PostHog) | ❌ 없음 | — |

### 발견 1건의 재활용 가능성
`NEXT_PUBLIC_NAVER_LOGIN_ENABLED`는 단순 boolean 토글로 단일 기능에 묶여 있음. 디자인 개편용으로 재활용 부적절 (의미 충돌).

### 개편 작업 시 영향도/조치 필요 사항
- **Flag 시스템 없음 = 개편 코드를 점진 노출할 수단 zero**. 다음 중 하나를 신설 필요:
  - 옵션 A: `NEXT_PUBLIC_NEW_DESIGN_ENABLED` 환경변수 (Vercel UI 토글, 가장 단순)
  - 옵션 B: `?ui=new` 쿼리스트링 + 쿠키 회귀 (LEE/내부자만 스위치)
  - 옵션 C: A+B 조합 — env로 글로벌 활성, 쿠키로 사용자 단위 opt-in/out
- 기존 `naverLogin.ts` 패턴(클라이언트/서버 양쪽에서 `?.trim()` 으로 검증)을 참고해 `featureFlag.ts` 헬퍼 신설 가능.

---

## 3. 테스트 인프라

| 항목 | 상태 |
|---|---|
| Playwright (`@playwright/test`) | ⚠️ devDep 1.59.1 설치되어 있으나 **config 파일·spec 파일 0건** |
| Cypress | ❌ 미설치 |
| Vitest / Jest | ❌ 미설치 |
| `@testing-library/*` | ❌ 미설치 |
| `*.test.ts(x)` / `*.spec.ts(x)` 파일 | ❌ 0건 |
| `e2e/`, `tests/`, `__tests__/` 디렉토리 | ❌ 없음 |
| `.github/workflows/` (CI) | ❌ **디렉토리 자체 없음** |

### 개편 작업 시 영향도/조치 필요 사항
- **회귀 테스트 zero-state.** 수동 검증에 100% 의존. 디자인 개편처럼 광범위 변경에서 위험 큼.
- 최소한 Playwright는 설치만 돼 있으니 **e2e 회귀 5~7개 시나리오**를 §5 핵심 플로우 기반으로 신설 권장:
  1. 비로그인 → /login → Google or Naver → /studio 도달
  2. 작품 등록 → 회차 1개 등록 → 단일 분석 시작 → 결과 확인
  3. 일괄 분석 5화 → 진행 상태 표시 → 결과 확인
  4. NAT 잔량 표시 정확성 (헤더, /billing)
  5. 1:1 문의 발송 + 답변 알림 수신
- CI 부재 → 개편 기간엔 GitHub Actions 도입 권장 (build + lint + e2e). Vercel build만으론 e2e 회귀 안 잡힘.

---

## 4. 디자인 시스템 현황

| 항목 | 상태 |
|---|---|
| `tailwind.config.ts/js` | ❌ **없음** (Tailwind v4 CSS-first 사용 — `@import "tailwindcss"` + `@theme inline {}`) |
| `src/app/globals.css` CSS 변수 | ✅ **38개** (`:root` 2개 + `@theme inline` 36개) |
| `src/components/ui/` 폴더 | ❌ 없음 |
| shadcn/ui (`components.json`) | ❌ 미사용 |
| `var(--*)` 사용처 | ✅ **97곳** (CSS 변수 기반 토큰화 부분 도입됨) |
| hex 직접 삽입 (`#XXXXXX`) | ⚠️ **13곳** (tsx 8, ts 5) |

### globals.css 내 토큰 분류 (현재)
- **사이드 패널**: bg/card/border/text/accent 등 14개 토큰
- **역할 뱃지**: protagonist/supporting/minor/villain 4개
- **어드민**: bg/border/text/accent/success/warning/danger/info 14개
- **글로벌**: background, foreground, font-sans, font-mono, header height 등 6개

### 개편 작업 시 영향도/조치 필요 사항
- **이미 토큰 기반 일부 도입**돼 있어 신규 디자인 토큰 추가 진입 장벽 낮음 — `@theme inline` 블록에 새 변수 정의 + 컴포넌트 마이그레이션 점진 가능.
- 사이드 패널/어드민 토큰은 **기능별 prefix** 패턴 정착됨 (`--color-sidepanel-*`, `--color-admin-*`). 신규 토큰도 같은 컨벤션 따를 것 (`--color-redesign-*` 또는 의미 prefix).
- hex 직박 13곳은 **이주 가능 수준** — 개편 작업 중 토큰화 동시 진행.
- shadcn 미사용 → 컴포넌트 추상화 부재. 개편 시 디자인 시스템 컴포넌트 (Button, Card, Modal 등) 신설 검토.

---

## 5. 핵심 사용자 플로우 식별

라우트 그룹(`(main)`)이 **없음** — 평면 라우트 구조. 인증 가드는 **`src/proxy.ts`** (Next.js 16 의 미들웨어, 이전 이름 `middleware.ts`) 에서 일괄 처리.

> 정정(2026-05-08): STEP 0 초안에서 "middleware 부재 + 가드 산재" 라고 적었으나, 실제로는 Next.js 16 명명(`proxy.ts`) 으로 검색 누락. 사이트는 `src/proxy.ts` 175줄에서 다음을 일괄 가드한다:
> - `/dashboard` → `/studio` redirect
> - `/explore/*` → `/` redirect (현재 비활성)
> - `/admin/*` role=admin 가드
> - `/` 로그인 사용자 → `/studio` redirect
> - 보호 경로(`/studio`, `/works`, `/billing`, `/notices`, `/verify-phone`) 비로그인 → `/login` redirect
> - Supabase 세션 갱신 + `ohb_session_hint` 쿠키
>
> 즉 페이지 코드의 명시 `redirect("/login")` 은 `auth/welcome` 1곳뿐이고, 나머지는 proxy.ts 에서 처리됨.

### 회귀 대상 플로우 → 라우트 매핑

| 플로우 | 라우트 | 인증 가드 | 데이터 fetching |
|---|---|---|---|
| 랜딩 | `/` (`src/app/page.tsx`) | 없음 | server component 정적 |
| 소셜 로그인 | `/login` → OAuth → `/auth/callback` → 약관 동의 시 `/auth/welcome` | server `redirect` (`appUser.ts:156`, `auth/welcome/page.tsx:14`) | server-side Supabase auth |
| 약관 동의 모달 | `/auth/welcome` (consent flow) — 클라이언트 모달 형태는 `FloatingInquiryButton.tsx` 외 별개 | server-side guard | server action |
| 작품 등록 | `/studio` → `/works/[id]/settings` (신규 작품 시) | server-side | RSC + form action |
| 회차 등록 | `/works/[id]/episodes/new` | server-side | RSC + client form |
| 회차 단일 분석 | `/works/[id]/episodes/[episodeId]` → API `/api/analyze` | server-side | RSC + 클라이언트 polling/realtime (`AnalysisJobsContext`) |
| 일괄(통합) 분석 | `/works/[id]/analysis` (`WorkAnalysisHub.tsx`) → API `/api/analyze-batch-holistic` | server-side | RSC + realtime |
| 분석 리포트 조회 | 위와 동일 라우트 — 결과 페이지 통합 | server-side | RSC |
| NAT 잔액 | 헤더 (`AppShellHeaderClient.tsx`) + `/billing` | client + server-side | client fetch + RSC |
| 결제 (sandbox) | `/pricing` → Paddle Checkout iframe | 비로그인 노출 가능 (서버에서 user.email props) | server fetch + client checkout |
| 마이페이지 | `/account` (계열 라우트 추가 가능성, 현재는 inquiry 위주) | server-side | RSC |
| 1:1 문의 | `FloatingInquiryButton` (모든 페이지 floating) → API `/api/contact/inquiry` | client-side modal | client form → server route |
| 알림 (헤더 벨) | `AppShellHeaderClient.tsx` + `AnalysisJobsContext` | 로그인 후만 활성 | Supabase Realtime |

### 라우트 일람 (제외: API)
```
/, /login, /auth/{callback,signout,welcome}, /studio, /works/[id]/{...}, /pricing,
/billing, /explore[/[id]], /notices, /privacy, /refund, /terms, /verify-phone,
/account/*, /admin/*, /dashboard
```

### 개편 작업 시 영향도/조치 필요 사항
- **라우트 그룹 부재**가 개편 분리 전략을 제약. `(legacy)` / `(new)` 그룹으로 fork하기 어렵고, 컴포넌트/페이지 레벨에서 flag 분기해야 함.
- ~~인증 가드가 **서버 컴포넌트마다 산재**~~ → **정정**: `src/proxy.ts` 에서 일괄 처리. 페이지 단위 가드 검증보다 proxy.ts 수정 회귀 테스트가 핵심.
- realtime + polling 혼용 흐름(`AnalysisJobsContext`)은 디자인 변경 시에도 **상태 채널 보존** 필수 — 컨텍스트 자체는 디자인 무관하므로 영향 적지만 헤더 벨/토스트 UI는 직결.

---

## 6. 성능 베이스라인

| 항목 | 상태 |
|---|---|
| `next.config.ts` 주요 설정 | `serverExternalPackages: ["chromadb", "@chroma-core/default-embed", "@huggingface/transformers"]`, `env.NEXT_PUBLIC_SENTRY_DSN`, **Sentry 통합 (`withSentryConfig`)** |
| Build 명령 | `next build --webpack` (Turbopack 비활성: `NEXT_DISABLE_TURBOPACK=1` in dev) |
| Sentry SDK | `@sentry/nextjs ^10.47.0` |
| Build output 사이즈 캡처 | ❌ **미수집** (LEE가 `npm run build` 결과 캡처 권장) |
| Lighthouse / Web Vitals 자료 | ❌ **없음** (코드베이스/문서 내 흔적 0) |

### 개편 작업 시 영향도/조치 필요 사항
- **베이스라인 측정 zero**. 개편 후 "느려졌다"를 데이터로 입증 못 함 → **개편 직전 1회 측정 필수**:
  - `npm run build` 결과 → 라우트별 chunk 사이즈 캡처
  - production /, /studio, /works/[id]/analysis, /pricing 4~5개 페이지 Lighthouse
  - 측정 결과는 `docs/redesign/01-baseline-perf.md` 등으로 별도 저장 권장
- Sentry는 이미 통합되어 있어 **에러 회귀**는 자동 감지 가능 (release 단위로 분리하면 더 좋음).
- Turbopack 비활성 상태 — 개편 기간 build 시간 부담 감안 필요.

---

## 7. CI/CD 현황

| 항목 | 상태 |
|---|---|
| GitHub Actions (`.github/workflows/`) | ❌ **없음** (repo root + onehandbook 모두) |
| `vercel.json` | ✅ 최소 설정 (`{ "$schema": ..., "framework": "nextjs" }`) |
| Vercel preview 자동 배포 | ✅ 추정 활성화 (Vercel 기본 동작, 별도 명시 없음 = 기본값) |
| 배포 파이프라인 (Vercel 외) | ❌ 없음 |
| 환경변수 분리 (Production/Preview/Development) | ✅ Vercel UI 기반 (TS-002 진단 시 LEE 직접 확인) |

### 개편 작업 시 영향도/조치 필요 사항
- **GitHub Actions 부재** → build 검증 + lint + e2e 자동화 zero. 개편 기간엔 PR 단위 자동 검증 추가 권장.
- Vercel preview는 PR마다 자동으로 뜨므로 **시각 검수**(LEE 본인)는 가능. 다만 e2e 회귀는 수동.
- 환경변수 분리는 정상 — 개편용 새 flag(예: `NEXT_PUBLIC_NEW_DESIGN_ENABLED`)도 같은 패턴으로 추가 가능.
- preview deploy URL을 **개편 검증용 staging**으로 활용 가능 — 별도 staging 환경 신설 불필요.

---

## 종합 요약

| 영역 | 안전망 수준 | 우선순위 조치 |
|---|---|---|
| 롤백 (Git) | 🟡 중 — clean state, 태그 zero | baseline 태그 1개 |
| Feature flag | 🔴 zero | flag 헬퍼 신설 (env + 쿠키 조합 권장) |
| 회귀 테스트 | 🔴 zero | Playwright 5~7 시나리오 + GitHub Actions |
| 디자인 토큰 | 🟢 부분 도입 | 신규 토큰 추가 + hex 직박 13개 이주 |
| 라우트 분리 | 🟡 평면 구조 | 컴포넌트 단위 flag 분기 (라우트 그룹 fork 어려움) |
| 성능 측정 | 🔴 zero | 개편 직전 build output + Lighthouse 1회 |
| CI/CD | 🟡 Vercel only | GitHub Actions 도입 검토 |

**가장 시급한 3개**:
1. 베이스라인 태그 + 측정 (롤백/비교 기준점)
2. Feature flag 헬퍼 (점진 노출 수단)
3. Playwright 회귀 시나리오 (광범위 변경 안전망)

이 3개가 갖춰지면 개편 작업을 안전하게 시작할 수 있다.
