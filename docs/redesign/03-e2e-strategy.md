# 디자인 개편 — E2E 회귀 테스트 전략

> STEP 1 작업 3 사전 리포트의 결정 사항 박제.
> 작업 3 코드 진입 전 입력 자료. 작업 4 ADR 작성 시 정식 ADR 로 승격 후보.

작성일: 2026-05-08
대상 브랜치: `feat/redesign`
관련 문서: [00-current-state](00-current-state.md), [02-route-inventory](02-route-inventory.md)

---

## 1. 결정 사항 (LEE 확정)

### 1-1. 시나리오 구조 — 7 spec
- `00-proxy-guards.spec.ts` 별도 신설 + LEE 원안 6개 비즈니스 플로우 보존
- 가드 회귀(인프라)와 비즈니스 회귀(UX)를 분리. 같이 깨지면 진단 어려움.

### 1-2. 시드 사용자 — admin API 매직링크 + storageState
- 흐름: `admin.auth.admin.createUser` → `admin.auth.admin.generateLink({ type: "magiclink" })` → Playwright 가 매직링크 follow → `context.storageState()` 로 저장 → 후속 spec 재사용
- 매번 createUser 안 함. storageState 캐시 활용. 만료 또는 schema 변경 시 재생성.
- 저장 위치: `playwright/.auth/writer.json`, `playwright/.auth/admin.json` (gitignore)

### 1-3. 시드 계정 (2개)

| 이메일 | role | 초기 상태 |
|---|---|---|
| `e2e_test_writer@novelagent.kr` | `user` | 기본 NAT 30, 작품 0개 |
| `e2e_test_admin@novelagent.kr` | `admin` | (일반 어드민 권한) |

### 1-4. e2e Supabase 격리 — 별도 프로젝트 (Free tier)
- production Supabase 와 완전 분리. 오염 위험 0.
- production schema 를 e2e 프로젝트에 한 번 적용 (`supabase/migrations/*` 일괄 실행)
- LEE 가 프로젝트 생성 + URL/keys 발급 후 Claude Code 에 전달

### 1-5. CI workflow — 작업 4 시점 결정
- 작업 3 에선 **로컬 npm scripts 만**:
  - `test:e2e`
  - `test:e2e:ui`
  - `test:e2e:regression`
  - `test:e2e:baseline`
  - `test:e2e:update-baseline`
- GitHub Actions 도입은 ADR 결정 후 작업 4 또는 별도 STEP

### 1-6. data-testid 정책 — B2 (role/aria/URL 우선)
- 회귀 테스트 selector 는 다음 우선순위:
  1. `getByRole("button", { name: ... })` 등 ARIA role
  2. URL 기반 검증 (`page.url()`, `expect(page).toHaveURL(...)`)
  3. 텍스트 매칭 (디자인 개편 시 깨질 가능성 인지하면서 사용)
  4. testid 는 **사용 안 함** (현재 코드에 0건)
- testid 도입은 **디자인 개편 페이즈에 점진** — 새 컴포넌트 작성 시 testid 박는 컨벤션 채택
- ADR 박제 예정: `ADR-XXX: E2E selector 전략`

---

## 2. 시나리오 구조 상세

### 2-1. 7 spec 트리

```
e2e/regression/
├── 00-proxy-guards.spec.ts     # proxy.ts 가드 회귀 (인프라)
├── 01-landing.spec.ts           # 비로그인 랜딩 카피/CTA
├── 02-auth-flow.spec.ts         # 로그인 흐름 (시드 세션 주입)
├── 03-novel-create.spec.ts      # 작품 생성
├── 04-analysis-request.spec.ts  # 분석 요청 + NAT 차감
├── 05-report-view.spec.ts       # 리포트 페이지 데이터 노출
└── 06-nat-balance.spec.ts       # NAT 잔량 + 충전 페이지 진입

e2e/baseline/
└── visual-baseline.spec.ts      # 스크린샷 비주얼 기준선

e2e/fixtures/
├── auth.ts                      # createUser + magiclink + storageState 헬퍼
└── test-user.ts                 # playwright fixture (test.extend)
```

### 2-2. 8개 체크리스트 → `00-proxy-guards` 매핑

| LEE 8 체크리스트 | spec 항목 | 검증 방법 |
|---|---|---|
| #1 비로그인 `/studio` → `/login` | `00-proxy-guards.spec` | unauthenticated context, expect URL `/login` |
| #2 비로그인 `/works/[id]` → redirect | 동상 | dummy id |
| #3 비로그인 `/billing` → redirect | 동상 | — |
| #4 로그인 `/` → `/studio` | 동상 | writer storageState |
| #5 비-admin `/admin` 차단 | 동상 | writer storageState |
| #6 로컬 dev `/dev/flags` 보임 | (자동 시연 완료, e2e 외) | curl 검증 — 2026-05-08 통과 |
| #7 production `/dev/flags` → `/` | (e2e 환경 외, LEE Vercel 검증) | — |
| #8 `/dashboard` → `/studio` | `00-proxy-guards.spec` (자동 시연 완료) | unauthenticated, expect URL `/studio` |

→ `00-proxy-guards.spec` 에 6개 case (#1~5, #8). #6/#7 은 별도 환경.

### 2-3. 비즈니스 spec 골격 (LEE 원안 따라)

| spec | 핵심 검증 |
|---|---|
| `01-landing` | `/` 진입, 주요 CTA(로그인 버튼) 노출, 비로그인 상태 유지 |
| `02-auth-flow` | 시드 사용자 storageState load, `/studio` 도달 |
| `03-novel-create` | 작품 등록 form → DB row 생성 검증 (Supabase admin client 으로 cleanup) |
| `04-analysis-request` | 회차 등록 + 분석 시작 → `analysis_jobs` 생성 + NAT 차감 검증 |
| `05-report-view` | 분석 완료 후 리포트 페이지 진입, 핵심 데이터 노출 |
| `06-nat-balance` | 헤더 NAT 표시 + `/billing` 진입 + 잔량 일치 |

각 spec 은 시각 검증보다 **URL + role + 데이터 정합성** 위주.

---

## 3. 신설 파일 목록 (작업 3 진입 시 14개)

| # | 파일 | 종류 |
|---|---|---|
| 1 | `playwright.config.ts` | 신설 |
| 2 | `e2e/fixtures/auth.ts` | 신설 |
| 3 | `e2e/fixtures/test-user.ts` | 신설 |
| 4 | `e2e/regression/00-proxy-guards.spec.ts` | 신설 |
| 5 | `e2e/regression/01-landing.spec.ts` | 신설 |
| 6 | `e2e/regression/02-auth-flow.spec.ts` | 신설 |
| 7 | `e2e/regression/03-novel-create.spec.ts` | 신설 |
| 8 | `e2e/regression/04-analysis-request.spec.ts` | 신설 |
| 9 | `e2e/regression/05-report-view.spec.ts` | 신설 |
| 10 | `e2e/regression/06-nat-balance.spec.ts` | 신설 |
| 11 | `e2e/baseline/visual-baseline.spec.ts` | 신설 |
| 12 | `.gitignore` | 수정 (test-results, playwright-report, playwright/.auth, .cache 추가) |
| 13 | `package.json` | 수정 (e2e 5개 script 추가) |
| 14 | `.env.local.example` | 수정 (`E2E_*` 환경변수 추가) |

총 14개. CLAUDE.md "5개 이상 파일 신규/수정" 룰 적용 — 사전 보고 + 승인 필수 (이 문서가 그 보고).

---

## 4. 환경변수 (e2e 전용)

`.env.local.example` 추가 제안:
```bash
# E2E test (Playwright). production Supabase 절대 사용 금지.
PLAYWRIGHT_BASE_URL=http://localhost:3000
E2E_SUPABASE_URL=
E2E_SUPABASE_ANON_KEY=
E2E_SUPABASE_SERVICE_ROLE_KEY=
E2E_TEST_WRITER_EMAIL=e2e_test_writer@novelagent.kr
E2E_TEST_ADMIN_EMAIL=e2e_test_admin@novelagent.kr
```

LEE Supabase 프로젝트 발급 후 채움.

---

## 5. 진입 게이트 (작업 3 코드 진입 조건)

다음 두 조건 **모두** 충족해야 작업 3 코드 진입:

1. ✅ LEE 8개 체크리스트 통과 보고 (#1~5, #7. #6/#8 은 자동 시연 완료)
2. ✅ e2e Supabase 프로젝트 URL/keys 발급 + 마이그레이션 적용

위 둘 충족 전까지: 이 문서 + 04로 박제. 코드 진입 보류.

---

## 6. 작업 4 ADR 후보

작업 4 시점에 ADR 로 정식 승격할 항목:

| ADR 후보 | 핵심 결정 |
|---|---|
| `ADR-XXX: E2E selector 전략` | role/aria/URL 우선, testid 점진 도입 (현 정책 1-6) |
| `ADR-XXX: E2E 환경 격리` | dedicated Supabase project + production 절대 분리 |
| `ADR-XXX: 디자인 개편 안전망 전체` | git 태그 + flag + e2e + visual baseline 종합 (작업 1+2+3 통합 ADR) |

---

## 7. Open questions (작업 3 코드 진입 시 결정)

- e2e Supabase 의 마이그레이션 적용 방법: `supabase db push` CLI vs SQL 직접 실행 vs separate migration script?
- visual baseline 의 스크린샷 storage: git 직접 vs LFS vs CI artifact?
- 시드 사용자 cleanup: 매 spec 후 row 삭제 vs DB reset?
- analysis 시나리오의 LLM 호출 mock 여부: real LLM (비용↑) vs mock 응답 (정확도↓)?

위 4개는 작업 3 코드 작성 시점에 LEE 결정 필요.

---

## 8. Related

- 작업 1 commit `247969b` (baseline tag), tag `v-pre-redesign`
- 작업 2 commit `cb0be97` (docs 정정), `495aa4b` (feat: flag 시스템)
- 작업 2 자동 시연: `/dashboard` → `/studio` 307 ✅, `/dev/flags` 200 ✅
- LEE 검증 대기: #1~5, #7
