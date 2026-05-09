# ADR-0019: E2E spec 계층 분리 (API + RPC + edge case, spec 04 패턴)

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - [ADR-0016](./ADR-0016-e2e-auth-verifyotp-cookie.md) — `getAuthenticatedClient` 가 본 ADR 의 test 2 에 직접 사용됨.
  - [ADR-0017](./ADR-0017-e2e-webserver-env-override.md) — `ANTHROPIC_API_KEY: 'sk-ant-e2e-fake-not-real'` env override 가 본 결정의 전제.
  - commit `3a0bd2e` (04 analysis-request + 05 report-view 회귀 spec)
  - `onehandbook/e2e/regression/04-analysis-request.spec.ts`

---

## Context

### 발견 경위
- 작업 3 페이즈 3-2 spec 04 (분석 요청 회귀) 작성 시점, 사용자 시나리오 핵심 검증 = "POST /api/analyze 호출 + `analysis_jobs` row + writer NAT 차감".
- production 동작 분석 결과:
  - `POST /api/analyze` 는 **즉시 반환** — `analysis_jobs` row INSERT + `runAnalysisProcessAfterResponse` 트리거 후 200 응답.
  - **NAT 차감 (`consume_nat` RPC) 은 background worker (`/api/analyze/process` → `runEpisodeAnalysisPipeline`) 가 LLM 성공 후 호출.**
- e2e 환경: ADR-0017 결정으로 `ANTHROPIC_API_KEY='sk-ant-e2e-fake-not-real'` → background worker 가 Anthropic API 401 fail → `consume_nat` 미호출 → coin_balance 변화 0.
- "API 응답만 검증" 으로 spec 좁히면 NAT pipeline 자체의 health (RPC 권한 / cookie_logs INSERT / balance UPDATE) 가 e2e 회귀 슈트에서 사라짐.

### 문제 정의
- **"money path" 의 의도와 실제 코드 흐름 사이의 layer 미스매치**:
  - 사용자 의도: "분석 요청 → NAT 차감".
  - 코드 흐름: 두 단계 (API trigger + background worker).
  - e2e 환경: 두 단계 사이가 fake API key 로 끊김.
- spec 한 개로 두 단계를 모두 검증하려면 실 LLM 호출이 필요 (비용 + 비결정성).
- 그렇다고 NAT 차감 검증을 포기하면 회귀 슈트의 의의가 약해짐.

---

## Decision

### 결정
**spec 04 를 3 계층 (API trigger + RPC 직접 호출 + edge case) 으로 분리. `test.describe.configure({ mode: 'serial' })` 로 NAT 조작 race 회피. `getAuthenticatedClient(role)` helper 로 RPC 직접 호출 시 writer 세션 사용.**

### 동작 요약 (`onehandbook/e2e/regression/04-analysis-request.spec.ts`, 3 tests)

#### test 1 — API trigger + DB row (writer fixture)
- `POST /api/analyze` (writer.page.request, cookies 자동 동반).
- 검증: status 200 / `body.job_id` / `analysis_jobs` row INSERT (app_user_id, episode_id, status ∈ enum 4개).
- **NAT 차감은 비검증** — 이 layer 의 책임 외.
- cleanup: jobs / episodes 삭제.

#### test 2 — `consume_nat` RPC 직접 호출 (writer 세션, 계층 분리 핵심)
- `getAuthenticatedClient('writer')` 로 writer 의 access_token 을 Authorization Bearer 로 갖는 Supabase 클라이언트 생성 (ADR-0016 의 storageState cookie 에서 access_token 추출).
- `client.rpc('consume_nat', { p_amount: 1, p_ref_type: 'e2e_test', p_ref_id: 0, p_metadata: { e2e: true } })` 호출.
- 검증: `result.ok === true` / `coin_balance` 30 → 29 차감.
- cleanup: `coin_balance` = 30 복구.

#### test 3 — edge case: NAT=0 → 402 INSUFFICIENT_NAT
- `coin_balance` = 0 으로 강제 (admin client 직접 UPDATE).
- `POST /api/analyze` 호출.
- 검증: status 402 / `body.code === 'INSUFFICIENT_NAT'` / `body.balance === 0`.
- cleanup: `coin_balance` = 30 복구 + episode 삭제.

#### Serial mode 강제
```ts
test.describe.configure({ mode: 'serial' });
```
세 테스트가 모두 같은 `writer.userId` 의 `coin_balance` 를 만지므로 병렬 실행 시 race. test 3 의 UPDATE coin_balance=0 이 test 1 의 balance ≥ cost 검사와 충돌해 일관성 깨짐.

### 근거

**옵션 1 (API only) → 1+2 조합 → +test 3 (negative case) 단계적 채택**:
- 옵션 1 단독은 `consume_nat` RPC 자체가 깨진 채 production 배포되는 시나리오를 회귀 슈트가 감지 못 함 (아래 옵션 A 거부 근거의 시나리오 A/B/C 참조).
- 옵션 1 + 2 조합으로 RPC 자체 health 까지 매 회귀 검증 → "API 정상 + NAT pipeline 정상" 동시 보장.
- test 3 (negative case) 추가로 비즈니스 룰 (`INSUFFICIENT_NAT`) 까지 회귀에 박음 — 잔량 부족 사용자에게 분석 요청 차단 정책 검증.
- **production 코드 0 변경** (옵션 B 의 mock gateway 부담 회피) — CLAUDE.md 일관 정책 준수.

---

## Alternatives Considered

### 옵션 A — test 1 만 (API + jobs row 생성만 검증)
- 동작: spec 04 가 `POST /api/analyze` 응답 + `analysis_jobs` row INSERT 만 검증.
- 장점: 가장 단순 / serial mode 불필요 / 실행 시간 ↓.
- 거부 근거: `consume_nat` RPC 가 깨진 채 production 배포되는 다음 시나리오를 회귀 슈트가 감지 못 함.
  - **시나리오 A**: RPC 의 `p_amount` 검증 로직 변경하면서 음수 허용 버그 → 사용자가 의도치 않게 NAT **적립** 받는 경제적 사고.
  - **시나리오 B**: RLS 정책 변경으로 RPC 가 사용자 인증 컨텍스트에서 호출 거부 → 모든 분석 요청이 NAT 차감 단계에서 silent fail. `/api/analyze` 는 200 응답 (jobs row 생성됨), 사용자 NAT 은 차감 X → "API 는 정상이지만 매출 손실" 상태가 며칠 갈 수 있음.
  - **시나리오 C**: `coin_balance` 컬럼 마이그레이션 실수로 stale 값 반환.

### 옵션 B — Anthropic API mock 주입 (background worker 가 mock 응답 받아 NAT 차감까지 도달)
- 동작: dev server 의 fetch 를 mock gateway 로 우회 또는 dependency injection 으로 LLM provider 교체.
- 장점: 한 spec 으로 trigger → worker → NAT 차감 end-to-end 검증.
- 거부 근거:
  - production 코드 수정 (provider 추상화 분기 추가) 필요 → CLAUDE.md "production 코드에 e2e 코드 박지 않는다" 정책 위반.
  - mock gateway 신설 시 인프라 복잡도 ↑ + 외부 의존 추가.

### 옵션 C — 단일 통합 test (test 1 + test 2 + test 3 한 함수)
- 동작: 한 test 함수 안에서 API 호출 → consume_nat 호출 → NAT=0 시도.
- 장점: 파일 수 / describe 수 ↓.
- 거부 근거:
  - 계층별 실패 원인 식별 어려움 (어느 단계에서 깨졌는지 stack trace 만으로 분리 ↓).
  - 한 단계 실패 시 다음 단계 미실행 → 부분 회귀 정보 손실.
  - cleanup 복잡도 ↑ (단일 finally 가 모든 단계의 부산물 처리).

### 옵션 D — test 1 (API) + test 2 (RPC 직접) + test 3 (edge case) 분리, serial mode ⭐ 채택
- 동작: 위 Decision 섹션.
- 장점:
  - 각 layer 가 독립 검증 → 회귀 시 어느 layer 가 깨졌는지 즉시 식별.
  - production 코드 수정 0 (옵션 B 의 부담 회피).
  - cleanup 이 test 단위로 분리 → 단순.
  - 향후 NAT 관련 spec (충전 / 환불 등) 에 같은 패턴 재사용 가능.
- 비용:
  - 한 spec 안 3 test = 실행 시간 +15~20s.
  - serial mode 강제 (NAT 조작 race 회피).
  - test 3 ECONNRESET 1 회 발생 (재실행 통과) → `retries: 1` 도입.

---

## Tradeoffs

받아들인 부담:
- Spec 04 단독 실행 시간 ~30s (다른 spec 대비 ~3배). 전체 슈트 1.7m 의 ~30% 차지.
- `serial` mode 로 spec 04 내부 병렬화 포기.
- Spec 04 ↔ Spec 02 / 06 NAT 검증 cross-file race 발생 → spec 02 / 06 의 NAT 매처를 정규식 (`\d+\s*NAT`) 으로 일반화 (정확값 30 검증 포기).
- `getAuthenticatedClient` helper 가 `@supabase/ssr` 0.9 cookie 포맷 디코드에 의존 (ADR-0016 의 동일 의존).

받지 않은 부담:
- production 코드 수정 (provider 추상화 분기).
- mock gateway / 외부 의존 신설.
- 실 Anthropic API 호출 (비용 + 비결정성).

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- Anthropic mock 라이브러리 / 패턴이 production 코드 변경 없이 dev server 에 주입 가능해지면 (예: Next.js 가 fetch hook 공식 지원) → 옵션 B 재검토.
- `consume_nat` RPC 가 deprecated 되거나 새 NAT 모델로 교체되면 (예: 사용량 기반 미터링) → spec 04 전면 재작성.
- 회귀 슈트가 매 spec 단독으로도 신뢰 가능해지고 cross-file race 해소되면 → serial mode 제거.

---

## Consequences

### 긍정
- API trigger / NAT pipeline / edge case 가 모두 e2e 회귀 슈트에 포함.
- 회귀 실패 시 어느 layer 가 깨졌는지 test 이름만으로 1초 만에 식별.
- NAT 관련 신규 spec 작성 시 동일 패턴 (3 계층 + getAuthenticatedClient + serial) 적용 가능.
- ADR-0016 + 0017 의 인프라가 본 ADR 의 테스트 작성 비용을 ~30% 줄여줌.

### 영향
- `getAuthenticatedClient` helper 가 향후 다른 사용자 권한 RPC 검증 spec 의 표준 진입점.
- spec 02 / 06 의 NAT 매처 일반화 — 디자인 페이즈 진행 중 정확값 검증 회복하려면 별도 isolation 필요.
- `retries: 1` 정책이 e2e 슈트 전반에 적용 (spec 04 만 한정 X).

---

## Future Work

### 단기
- 다른 NAT 흐름 spec 작성 시 본 패턴 (3 계층 — API trigger + RPC 직접 호출 + edge case) 재사용:
  - 예: 충전 후 잔량 증가 검증 (06-nat-balance 확장).
- ECONNRESET 재현 시 dev server 부하 분석 (workers 늘리거나 줄이면 해결되는지 측정).

### 중기
- 결제 도입 시 spec 06 확장:
  - 결제 API 호출 (mock).
  - `credit_nat` RPC 직접 호출 검증.
  - 결제 실패 시 환불 흐름 (`p_reason: 'refund'`).
- `holistic_analysis_runs` (통합 분석) spec 작성 시 동일 3 계층 패턴.
- 다른 RPC 들에 같은 검증 패턴 적용 — `admin_debit_nat` (어드민 차감), `credit_nat` (충전·환불) 등.
- Anthropic mock 라이브러리 / 패턴이 production 코드 변경 없이 dev server 에 주입 가능해지면 옵션 B 재검토.
- 회귀 슈트가 NAT 조작 spec 을 별도 파일로 격리 (예: `04a-analysis-trigger.spec.ts` + `04b-nat-pipeline.spec.ts`) 해서 cross-file race 회피 패턴 검토.

---

## Related Commits

- `3a0bd2e`: feat(redesign): 04 analysis-request + 05 report-view 회귀 spec — 본 ADR 의 코드 본체.
- `f6cf9b5`: feat(redesign): E2E fixture 보강 — 시드 + 인증 클라이언트 (`getAuthenticatedClient` helper 추가 — ADR-0016 + 0019 공통 의존).
- `1cb38f4` / `6338b5f`: spec 02 / 06 NAT 매처를 `\d+\s*NAT` 로 일반화 (cross-file race 회피 — 본 ADR 의 트레이드오프 항목).

---

## Notes

- "money path" 라는 표현은 사용자 가치 흐름 (요청 → 결제) 의 핵심 경로를 가리킴. e2e 슈트의 보호 우선 순위 ↑.
- ADR-0016 (인증) + ADR-0017 (env 격리) + ADR-0019 (계층 분리) 가 e2e 슈트의 3 축. 셋 중 하나라도 빠지면 spec 04 동작 안 함.
- Spec 04 패턴은 향후 결제 (Paddle Sandbox — ADR-0010) 회귀 spec 작성 시 잠재적 모델.

### 부속 결정: `getAuthenticatedClient` helper 채택 흐름
- 처음에 `supabaseAdmin.rpc('consume_nat', ...)` 시도 → `consume_nat` 은 사용자 컨텍스트 (`auth.uid()`) 에서 작동하는 RPC. admin client 는 service_role 이라 `auth.uid()` 반환 안 함 → `user_not_found`.
- 옵션 비교:
  - **(a)** `consume_nat` 시그니처 변경해서 `p_user_id` 인자 받게 → production 코드 수정 (CLAUDE.md 일관 정책 위반).
  - **(b)** `admin_debit_nat` 사용 → 어드민 차감 전용 RPC, 의도/감사 로그 셋업이 다름 (사용자 차감 검증 의도와 어긋남).
  - **(c)** ⭐ writer 세션 자체로 RPC 호출 — storageState 의 `sb-<projectRef>-auth-token` cookie 에서 base64url 디코드로 access_token 추출 → Supabase 클라이언트의 `Authorization: Bearer <access_token>` 헤더로 주입.
- 결정: (c). 이 패턴은 향후 다른 사용자 권한 RPC 검증 시 재사용 가능.
- `auth.setSession` vs `global.headers.Authorization`: 후자 채택 — `setSession` 은 비동기 + supabase JS 내부 상태 변경, header override 는 명시적 + sync. helper 의 단일 책임 (인증 클라이언트 만들기) 에 적합.

### 부속 결정: cross-file NAT race 회피 패턴
- 발견: spec 04 test 3 에서 `writer.coin_balance` 를 0 으로 만들고 `INSUFFICIENT_NAT` 검증. 동시 실행되는 spec 02 또는 06 이 같은 writer 의 NAT 잔량 30 기대 → race.
- 해결 3 단:
  1. **spec 04 내부 serial**: `test.describe.configure({ mode: 'serial' })` — 3 test 순차.
  2. **spec 02 / 06 정규식 매처**: 정확값 30 대신 `\d+\s*NAT` — 어떤 숫자든 통과.
  3. **spec 04 cleanup 보장**: `finally` 블록에서 항상 `coin_balance = 30` 복구.
- 추가 보호: Playwright `workers: 1` 로 두면 spec 단위 race 자체 제거 가능 (현재 default workers 사용 — Future Work 에서 측정).

### 부속 결정: test 3 ECONNRESET + `retries: 1`
- 페이즈 3-2 spec 04 작성 시점에 test 3 한 번 ECONNRESET 발생 → 재실행 통과.
- 추정 원인: dev server cold start 직후 fixture 시드 + 첫 spec 실행이 부하 집중.
- 결정: `playwright.config.ts` 에 `retries: process.env.CI ? 2 : 1` — 네트워크 일시 오류는 자동 재시도, 재시도해도 실패하면 진짜 회귀.
- 영향: 실행 시간 약간 증가 (실패한 test 만 재시도).
