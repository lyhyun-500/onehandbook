# 디자인 개편 — 라우트 인벤토리 (정식 매핑)

> STEP 1 작업 2 사전 리포트 점검 3을 정식 문서화.
> 시안 10화면 vs 현재 코드베이스 라우트 정합성 점검.
> 디자인 개편 시 어느 라우트가 영향받는지 baseline 매핑.

작성일: 2026-05-08
대상 브랜치: `feat/redesign`

---

## 섹션 1. 현재 코드베이스 라우트 전체 인벤토리

### 1-1. 페이지 라우트 (사용자 노출)

| 경로 | 파일 | RSC/CC | 인증 가드 | 동적 | 비고 / CLAUDE.md 명시 |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | RSC | 없음 | static | 메인 랜딩 (CLAUDE.md 핵심) |
| `/login` | `src/app/login/page.tsx` | RSC | 없음 | static | 소셜 로그인 (Google + Naver) |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | **CC** (`"use client"`) | 없음 (auth 처리 자체) | dynamic | OAuth 콜백 — 시안 03 화면 |
| `/auth/welcome` | `src/app/auth/welcome/page.tsx` | RSC | `redirect("/login")` 직접 호출 | dynamic | 약관 동의 모달 |
| `/auth/signout` | `src/app/auth/signout/route.ts` | route handler | — | dynamic | 로그아웃 처리 |
| `/auth/callback/naver` | `src/app/auth/callback/naver/route.ts` | route handler | — | dynamic | 네이버 OAuth 콜백 |
| `/studio` | `src/app/studio/page.tsx` | RSC | 명시 가드 없음 (layout 또는 내부 처리) | static | **작가 대시보드** (CLAUDE.md 핵심) |
| `/works/[id]` | `src/app/works/[id]/page.tsx` | RSC | 명시 가드 없음 | dynamic | **작품 상세** — 시안 2번 화면 |
| `/works/[id]/settings` | `src/app/works/[id]/settings/page.tsx` | RSC | 명시 가드 없음 | dynamic | 작품 설정 |
| `/works/[id]/analysis` | `src/app/works/[id]/analysis/page.tsx` | RSC | 명시 가드 없음 | dynamic | **분석 결과 페이지** — 시안 3번 |
| `/works/[id]/episodes/new` | `src/app/works/[id]/episodes/new/page.tsx` | RSC | 명시 가드 없음 | dynamic | 회차 등록 |
| `/works/[id]/episodes/[episodeId]` | `src/app/works/[id]/episodes/[episodeId]/page.tsx` | RSC | 명시 가드 없음 | dynamic | 회차 상세 |
| `/works/[id]/episodes/[episodeId]/edit` | `src/app/works/[id]/episodes/[episodeId]/edit/page.tsx` | RSC | 명시 가드 없음 | dynamic | 회차 편집 |
| `/explore` | `src/app/explore/page.tsx` (+ `layout.tsx`) | RSC | 없음 (layout에서 별도 처리) | static | 작품 탐색 |
| `/explore/[id]` | `src/app/explore/[id]/page.tsx` | RSC | 명시 가드 없음 | dynamic | 탐색 상세 |
| `/explore/[id]/episodes/[episodeId]` | `src/app/explore/[id]/episodes/[episodeId]/page.tsx` | RSC | `auth.getUser()` 사용 | dynamic | 회차 상세 (탐색용) |
| `/pricing` | `src/app/pricing/page.tsx` (+ `StandardPlanButton.tsx` CC) | RSC + CC 부분 | `auth.getUser()` (props 전달용, 가드 X) | dynamic | 요금 안내 + 결제 진입 (paddle) |
| `/billing` | `src/app/billing/page.tsx` | RSC | 명시 가드 없음 | dynamic | NAT 잔량/이력 |
| `/account` | `src/app/account/page.tsx` | RSC | 명시 가드 없음 | dynamic | 계정/마이페이지 |
| `/account/inquiries` | `src/app/account/inquiries/page.tsx` | RSC | 명시 가드 없음 | dynamic | 1:1 문의 목록 |
| `/notices` | `src/app/notices/page.tsx` | RSC | 없음 | static | 공지사항 |
| `/terms` | `src/app/terms/page.tsx` | RSC | 없음 | static | 이용약관 |
| `/privacy` | `src/app/privacy/page.tsx` | RSC | 없음 | static | 개인정보 |
| `/refund` | `src/app/refund/page.tsx` | RSC | 없음 | static | 환불 정책 |
| `/verify-phone` | `src/app/verify-phone/page.tsx` | RSC | 명시 가드 없음 | dynamic | 휴대폰 인증 |
| `/admin` | `src/app/admin/page.tsx` (+ `layout.tsx`) | RSC | `requireAdmin()` (layout 또는 직접) | dynamic | 어드민 진입 |
| `/admin/users` | `src/app/admin/users/page.tsx` | RSC | `requireAdmin()` | dynamic | 유저 목록 |
| `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | RSC | `requireAdmin()` | dynamic | 유저 상세 |
| `/admin/inquiries` | `src/app/admin/inquiries/page.tsx` | RSC | `requireAdmin()` | dynamic | 문의 목록 |
| `/admin/withdrawals` | `src/app/admin/withdrawals/page.tsx` | RSC | `requireAdmin()` | dynamic | 탈퇴 로그 |

### 1-2. `/dashboard` — 빈 디렉토리 (작동 라우트 아님)

```
src/app/dashboard/
└─ (빈 디렉토리, page.tsx 0건)
```

git log 추적:
- 첫 등장: commit `13eccd3 feat: Novel Agent 앱(onehandbook) 및 문서·마이그레이션 추가` (4월 초)
- 이후 `da346fc feat: 분석 백그라운드`, `79dad85 feat(trends): add Munpia reader ingest pipeline` 에서 디렉토리 자체는 잔류
- **page.tsx 작성된 적 없음** — 초기 구상 placeholder가 그대로 잔재

**조치 권장**: 빈 디렉토리 삭제 (별도 작업, 이번 범위 외). Next.js에서 빈 디렉토리는 라우트로 인식 안 됨 → 즉시 영향은 없지만 코드베이스 노이즈.

### 1-3. 인증 가드 패턴 분포

| 패턴 | 사용처 |
|---|---|
| `redirect("/login")` 직접 호출 | `auth/welcome/page.tsx` (1곳) |
| `requireAdmin()` (`src/lib/admin/requireAdmin.ts`) | admin 4개 page (users 목록/상세, inquiries, withdrawals) |
| `auth.getUser()` 명시 호출 (가드 + props) | `pricing`, `explore/[id]/episodes/[episodeId]` |
| middleware 기반 | **없음** (`src/middleware.ts` 부재) |
| `getOrCreateAppUser` (`src/lib/supabase/appUser.ts:156` redirect 포함) | 검색 결과 0건 — 정의는 있으나 page.tsx에선 미사용 |
| 명시 가드 없음 | 그 외 대부분 (`/studio`, `/works/[id]/*`, `/billing`, `/account` 등) |

**관찰**: `/studio`, `/works/[id]/*`, `/billing`, `/account` 같은 보호 대상 페이지에 **명시 가드 없음**. 페이지 내부에서 데이터 로드 시 anon 사용자에게 빈 상태 또는 fallback 노출하는 패턴으로 추정 (page.tsx 직접 정독 필요 시 별도 점검).

---

## 섹션 2. 시안 10화면 → 현재 라우트 매핑

| # | 시안 화면 | 시안 README 경로 | 현재 라우트 | 상태 | 비고 |
|---|---|---|---|---|---|
| 01 | 비로그인 랜딩 | `/` | `/` | 🟢 일치 | — |
| 02 | 로그인 모달 (전역 오버레이) | (전역) | (별도 라우트 X, OAuth 콜백 `/auth/callback`) | 🟡 부분 | 모달 vs 별도 페이지 형태 결정 필요 |
| 03 | 로그인 진행 스피너 | (전역) | `/auth/callback` (CC) | 🟢 존재 | 시안의 진행 스피너 = 콜백 페이지로 매핑 가능 |
| 04 | (시안 README상 누락 또는 미표기) | — | — | — | 시안 인덱스 재확인 필요 |
| 05A | 풀스크린 온보딩 | (가드 또는 라우트) | **없음** | 🔴 신규 | 시안 신규 도입. 별도 라우트(`/onboarding`) 또는 모달 결정 필요 |
| 05B | 빈 스튜디오 (작품 0개) | `/studio` (분기) | `/studio` (현재 분기 형태 미확인) | 🟡 분기 추가 | `/studio/page.tsx` 내부에 작품 0건 분기 추가 필요 |
| 05C | 도움말 popover (전역) | (전역) | **없음** | 🔴 신규 | 헤더 또는 floating 컴포넌트로 도입. 별도 라우트 X (헬프 콘텐츠 페이지는 별도) |
| 1 | Studio 대시보드 | `/studio` | `/studio` | 🟢 일치 | CLAUDE.md 작가 대시보드 |
| 2 | Work Detail | `/studio/[workId]` | **`/works/[id]`** | 🟡 **경로 차이** | 시안과 코드 불일치 — 결정 사항(섹션 5) |
| 3 | Analysis Report | `/studio/[workId]/analysis/[epId]` | **`/works/[id]/analysis`** | 🟡 **경로 차이** | 시안은 episodeId까지 path, 코드는 query 또는 내부 분기 추정 |
| 4 | 분석 실행 모달 (전역 오버레이) | (전역) | (전역 — 진입점 페이지에서 모달) | 🟡 모달 컴포넌트 존재 여부 확인 필요 | `WorkAnalysisHub.tsx` 내부에 있을 가능성 |

---

## 섹션 3. 누락 페이지 식별

### 3-1. 시안에 없지만 디자인 개편 대상일 수 있는 현재 페이지

| 라우트 | 현재 역할 | 디자인 개편 포함 여부 |
|---|---|---|
| `/pricing` | 요금 안내 + 결제 진입 (paddle) | LEE 결정 |
| `/billing` | NAT 잔량 + 이력 | LEE 결정 |
| `/account` | 계정/마이페이지 | LEE 결정 |
| `/account/inquiries` | 1:1 문의 | LEE 결정 |
| `/admin/*` (5개) | 어드민 패널 | **v2 — 별도 트랙** (시안에 없음) |
| `/terms`, `/privacy`, `/refund` | 약관/정책 | 통상 디자인 개편 대상 |
| `/notices` | 공지사항 | LEE 결정 |
| `/verify-phone` | 휴대폰 인증 | 거의 보지 않는 페이지 — 우선순위 낮음 |
| `/explore`, `/explore/[id]`, `/explore/[id]/episodes/[episodeId]` | 작품 탐색 | LEE 결정 (현재 베타 단계 활용도?) |
| FAQ 페이지 | **없음** | 도입 결정은 별개 작업 |

### 3-2. 시안에 있지만 현재 없는 페이지

| 시안 항목 | 현재 코드 | 도입 형태 결정 필요 |
|---|---|---|
| 풀스크린 온보딩 (05A) | 없음 | 별도 라우트(`/onboarding`) 또는 `/auth/welcome` 확장 |
| 헬프 콘텐츠 페이지 (popover 4항목 → "사용 가이드", "영상 투어" 등) | 없음 | 별도 라우트(`/help`, `/help/guide`, `/help/video-tour` 등) |

---

## 섹션 4. Feature Flag 권장 구성 결론

**LEE 결정 (작업 2 결정 1) 채택 — 7개 flag 확정**:

| # | flag | 라우트 | 페이즈 | 비고 |
|---|---|---|---|---|
| 1 | `landing` | `/` | 페이즈 2 | — |
| 2 | `studio` | `/studio` | 페이즈 3 | 작가 대시보드 (CLAUDE.md 핵심) |
| 3 | `work-detail` | `/works/[id]` | 페이즈 3 | 시안 2번 화면 (경로 차이 결정 보류) |
| 4 | `work-analysis` | `/works/[id]/analysis` | 페이즈 5 | 시안 3번 화면 |
| 5 | `pricing` | `/pricing` | 페이즈 5 | 머니 패스 인접 |
| 6 | `billing` | `/billing` | 페이즈 5 | 머니 패스 인접 |
| 7 | `account` | `/account` (+ `/account/inquiries`) | 페이즈 4 | LEE의 `mypage` rename |

**제외**:
- `admin` flag — 어드민 디자인 개편은 v2 별도 트랙
- `explore`, `notices`, `terms/privacy/refund`, `verify-phone` — 디자인 개편 우선 대상 외 (필요 시 후속 추가)

**대응 NEXT_PUBLIC_* 환경변수**:
```
NEXT_PUBLIC_REDESIGN_LANDING
NEXT_PUBLIC_REDESIGN_STUDIO
NEXT_PUBLIC_REDESIGN_WORK_DETAIL
NEXT_PUBLIC_REDESIGN_WORK_ANALYSIS
NEXT_PUBLIC_REDESIGN_PRICING
NEXT_PUBLIC_REDESIGN_BILLING
NEXT_PUBLIC_REDESIGN_ACCOUNT
```

---

## 섹션 5. 결정 보류 사항 (LEE 답변 필요)

### 5-1. 시안 vs 현재 라우트 경로 차이

시안 README의 핵심 페이지 경로가 현재 코드와 다름:

| 시안 README | 현재 코드 |
|---|---|
| `/studio/[workId]` (Work Detail) | `/works/[id]` |
| `/studio/[workId]/analysis/[epId]` (Analysis Report) | `/works/[id]/analysis` |

**3가지 옵션**:

- **옵션 A**: 라우트 자체를 시안에 맞춰 마이그레이션 (`/works/[id]/*` → `/studio/[workId]/*`)
  - 작업 규모 큼 (디렉토리 이동 + 기존 링크/북마크 영향)
  - SEO/외부 링크 영향 (현재 베타 단계라 영향 작긴 함)
  - 시안 의도 100% 일치
- **옵션 B**: 현재 라우트 유지, 시안 경로 무시
  - 작업 규모 0
  - 시안과 코드 영구 불일치 → 향후 신규 합류자 혼란
- **옵션 C**: rewrite 별칭 (`/studio/[workId]` → `/works/[id]` 내부 redirect)
  - `next.config.ts` 의 `redirects()` 또는 `rewrites()` 사용
  - 두 path 모두 작동, 사용자 노출은 시안 path
  - 작업 규모 중간 (next.config 1개 함수 추가)

**현재 작업 2 진행 정책**: **옵션 B 가정** (현재 라우트 기준). LEE 결정 후 별도 작업으로 마이그레이션 검토.

### 5-2. 풀스크린 온보딩 + 헬프 콘텐츠 도입 형태

시안 신규 항목들의 도입 형태 결정:
- 풀스크린 온보딩: `/onboarding` 별도 라우트 vs `/auth/welcome` 확장 vs 모달
- 헬프 콘텐츠: `/help` 라우트 트리 vs 외부 docs

이 결정은 디자인 페이즈 진입 시 별도 ADR 또는 시안 핸드오프 시 명시 권장.

### 5-3. 디자인 개편 대상에서 제외할 페이지

§3-1 표의 "LEE 결정" 항목들:
- `/pricing`, `/billing`, `/account*` → flag로 포함 (확정)
- `/admin/*` → v2 (확정)
- `/terms`, `/privacy`, `/refund`, `/notices`, `/verify-phone`, `/explore*` → 결정 보류

이번 STEP 1 작업 2에서는 7개 flag만 도입. 위 결정 보류 페이지는 추후 flag 추가 (env 변수 1개 + record 1줄로 확장 가능).

---

## 섹션 6. 다음 단계 (작업 2 진입)

본 인벤토리는 작업 2 (Feature Flag 도입) 의 라우트 매핑 근거로 사용된다. 작업 2에서 신설할 파일:

1. `src/lib/feature-flags.ts` (순수 평가 + types + ENV_FLAGS record)
2. `src/lib/feature-flags-server.ts` (server wrapper, `cookies()` 호출)
3. `src/lib/feature-flags-client.ts` (client wrapper, `useSearchParams()` + cookie)
4. `src/middleware.ts` (`/dev/*` production 차단)
5. `src/app/dev/flags/page.tsx` (쿠키 토글 UI)
6. `.env.local.example` (NEXT_PUBLIC_REDESIGN_* 7개 추가)

작업 진행 브랜치: `feat/redesign` (또는 `feat/redesign-feature-flags` 하위 분기)
