# Contributing Guide

> Novel Agent 디자인 개편 스프린트 (2026-05~) 의 기여 흐름.
> E2E 회귀 슈트 / 신규 spec 작성 / 함정 박제를 한 곳에서 박는다.

---

## E2E 환경 셋업 (1 회)

### 사전 준비
- **macOS**: `brew install libpq`
- **PATH 추가**: `export PATH="/opt/homebrew/opt/libpq/bin:$PATH"` (zshrc 등에 박기)
- **e2e Supabase 프로젝트**: PROD 와 분리된 별도 프로젝트 (project_ref 발급 필요).
  - Authentication → Email Provider 활성화 / Confirm email **OFF**
  - Site URL: `http://127.0.0.1:3000`
  - Redirect URLs: `http://127.0.0.1:3000/auth/callback`, `http://localhost:3000/auth/callback`

### `.env.local` 환경변수 6 개

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
E2E_SUPABASE_URL=https://<ref>.supabase.co
E2E_SUPABASE_ANON_KEY=sb_publishable_xxx
E2E_SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Legacy JWT — sb_secret_* 비호환 (ADR-0016)
E2E_TEST_WRITER_EMAIL=e2e_test_writer@novelagent.kr
E2E_TEST_ADMIN_EMAIL=e2e_test_admin@novelagent.kr
```

### 첫 실행

```bash
cd onehandbook
npm install
npx playwright install chromium
npm run test:e2e:regression
```

> 성공 시 7 spec / 20 active tests / ~1.7 분.

---

## 회귀 테스트 실행

| 목적 | 명령 |
|------|------|
| 전체 회귀 | `npm run test:e2e:regression` |
| 단일 spec | `npm run test:e2e:regression -- e2e/regression/00-proxy-guards.spec.ts` |
| UI 모드 (디버깅) | `npm run test:e2e:ui` |
| Visual baseline (디자인 페이즈 1 진입 후) | `npm run test:e2e:baseline` |
| Visual baseline 의도된 갱신 | `npm run test:e2e:update-baseline` |

---

## 신규 spec 작성 가이드

### Selector 전략 (ADR-0020)
1. `getByRole({ name: '...' })` — 가장 안정.
2. `getByPlaceholder('...')` — input 필드.
3. `getByText('...')` — 카피 변경 시 깨짐 위험 (디자인 페이즈에서 갱신).
4. URL 매칭 (`page.waitForURL`) — 라우트 기반.
5. CSS selector — 최후 수단.

### Fixture 사용 (ADR-0016)
- `writer` fixture: 인증된 작가 + NAT 30 + 시드 작품 1 개.
- `admin` fixture: 어드민 권한.
- 시드 데이터: `e2e/fixtures/seed.ts` 의 함수 (`seedEmptyWork` / `seedEpisode` / `seedAnalysisRun` / `seedAnalysisJob`) 사용.

### NAT pipeline 검증 spec (ADR-0019)
3 계층 분리 패턴:
- **test 1**: API 트리거 + DB row 검증 (`/api/analyze` 호출 후 `analysis_jobs` row 확인).
- **test 2**: RPC 직접 호출 (`getAuthenticatedClient` helper 로 `consume_nat` 호출 → 잔량 검증).
- **test 3**: 에지 케이스 (NAT 부족 시 402 + `INSUFFICIENT_NAT` 응답).

### 환경 격리 (ADR-0017)
- `playwright.config.ts` 의 `webServer.env` override 자동 작동 — E2E 변수가 dev server 에 주입됨.
- 별도 dev server 띄워두면 깨짐 (`reuseExistingServer: false` 강제).
- 매 e2e 실행마다 cold start (~5~10 초).

---

## 함정 요약 (commit 인용으로 검색 가능)

| 함정 | ADR / 문서 | commit |
|------|------------|--------|
| Next.js 16 `proxy.ts` vs `middleware.ts` | (commit 메시지) | `cb0be97` |
| Feature flag 7 개 + `/dev/*` 차단 | ADR-0018 | `495aa4b` |
| e2e Supabase IPv6 only | `docs/redesign/04-...replication-report.md` | `fa02daf` |
| `CREATE SCHEMA` / storage 권한 | `docs/redesign/04-...replication-report.md` | `fa02daf` |
| `sb_secret_*` admin API 비호환 | ADR-0016 | `4fcc48a` |
| `webServer.env` override + `reuseExistingServer:false` | ADR-0017 | `4fcc48a` |
| magiclink implicit-flow vs callback PKCE | ADR-0016 | `4fcc48a` |
| `credit_nat` `p_reason` allowlist | `docs/reference/nat-domain.md` | `f6cf9b5` |
| spec 04 NAT pipeline 미검증 | ADR-0019 | `3a0bd2e` |
| spec 04 ↔ spec 02/06 NAT race | ADR-0019 | `3a0bd2e` |
| `router.refresh()` / 모달 닫힘 race | (commit 메시지) | `c21b198` |
| storageState `access_token` 만료 → RPC 직접 호출 fail (`JWT expired`) | ADR-0019 (post-merge 섹션) + `isAccessTokenExpired` helper | (이번 commit) |

> commit hash 로 `git show <hash>` 하면 함정 발견 → 해결 흐름이 박혀 있음.

---

## Long-running task 박제 정책 (ADR-0021)

3+ 단계 또는 30 분+ 작업은 `docs/redesign/MINI-*.md` 파일로 박제.

명령서 표준 5+1 요소:
1. 전제 조건 (검증 명령 동반)
2. 단계 번호 + 진입 트리거 ("단계 1부터" 한 마디로 새 세션 진입 가능)
3. 단계별 보고 시점 + 승인 게이트
4. 보안 원칙 (production secret 코드/git/chat 미노출)
5. 자동 진행 vs 승인 게이트 명시
6. (옵션) Future Work / 회귀 영역

---

## 디자인 페이즈 진행 시 PR 체크리스트

### 시작 시
- [ ] 해당 flag 활성 (`NEXT_PUBLIC_REDESIGN_<page>=true`)
- [ ] 해당 페이지 spec 식별 (selector 갱신 필요 부분)

### 작업 중
- [ ] 신구 코드 동시 존재 (flag 분기 — 롤백 가능)
- [ ] testid 추가 (해당 페이즈 컴포넌트만 — ADR-0020 점진 도입)

### 종료 시
- [ ] spec selector 갱신 (testid 우선 전환)
- [ ] visual baseline 갱신 (`npm run test:e2e:update-baseline`)
- [ ] 회귀 통과 확인 (`npm run test:e2e:regression`)

---

## 관련 문서

- [README.md](../README.md) — 프로젝트 개요 + 디자인 개편 진행 상태
- [docs/adr/README.md](adr/README.md) — Architecture Decision Records (ADR-0001 ~ ADR-0021)
- [docs/reference/nat-domain.md](reference/nat-domain.md) — NAT 시스템 + 분석 도메인 fact
- [docs/redesign/03-e2e-strategy.md](redesign/03-e2e-strategy.md) — E2E 회귀 테스트 전략
- [docs/redesign/04-e2e-supabase-replication-report.md](redesign/04-e2e-supabase-replication-report.md) — e2e Supabase 복제 보고서
- [docs/redesign/00-current-state.md](redesign/00-current-state.md) — 디자인 개편 안전망 진단 + 진행 상태

### Deferred decisions (보류 결정 박제)
- [docs/redesign/05-visual-baseline-deferred.md](redesign/05-visual-baseline-deferred.md) — Visual baseline 도입 보류 (디자인 페이즈 1 진입 시 결정)
- [docs/redesign/06-ci-workflow-deferred.md](redesign/06-ci-workflow-deferred.md) — CI workflow (`.github/workflows/e2e.yml`) 도입 보류 (협업자 영입 / PR 빈도 ↑ / 회귀 누락 사고 시 도입)
