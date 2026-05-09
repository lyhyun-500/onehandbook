# ADR-0020: E2E selector 전략 — role/text 우선, testid 디자인 페이즈에 점진

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - [docs/redesign/03-e2e-strategy.md](../redesign/03-e2e-strategy.md)
  - [docs/redesign/05-visual-baseline-deferred.md](../redesign/05-visual-baseline-deferred.md) — 동일 정신 (디자인 페이즈 1 합병)
  - commit `1cb38f4` (01 landing + 02 auth-flow)
  - commit `c21b198` (03 novel-create)
  - commit `6338b5f` (06 nat-balance)
  - commit `3a0bd2e` (04 + 05)

---

## Context

### 발견 경위
- 작업 3 페이즈 1 도구 점검 시점에 코드베이스 grep 으로 `data-testid` 사용 **0 건** 확인.
- 페이즈 3 사전 분석 보고서 (작업 3 결정 1번) 에서 selector 전략 옵션 B1 / B2 / B3 검토.
- 디자인 전면 개편이 임박 (디자인 페이즈 1 시작 예정). 7 페이지 라우트가 페이즈마다 변경 — 컴포넌트 재작성 예정.
- 동시에 spec 01 ~ 06 작성 진행 중 — selector 결정이 매 spec 작성에 영향.

### 문제 정의
- 안정적 spec 작성을 위해서는 가능한 testid 가 이상적이지만, 현 코드에 0 건 → 추가하려면 selector 박을 PR 이 spec 작성과 별도로 필요.
- 디자인 개편이 곧 시작되므로 지금 박은 testid 가 페이즈 1 ~ 5 내내 살아남을지 불투명.
- AnalyzePanel.tsx (1000+ 줄) 같은 거대 컴포넌트는 텍스트/role 만으로 selector 추출이 어려움 — 예외 처리 필요할 수 있음.

---

## Decision

### 결정
**B2 — role / aria / URL / text 우선, `data-testid` 미도입. 디자인 페이즈 1 시작 시점에 토큰 / 컴포넌트 재작성과 함께 testid 점진 도입. AnalyzePanel.tsx 같은 거대 컴포넌트는 페이즈 3-2 spec 04 작성 시점에 부분 도입 여부 별도 결정.**

### 동작 요약 (현재 spec 01 ~ 06 의 selector 패턴)

| 패턴 | 사용처 | 예시 |
|---|---|---|
| `getByRole('heading', { name: /…/ })` | 페이지 검증 (h1/h2) | spec 01: `name: /당신의 원고/` |
| `getByRole('link', { name: '…' })` | 네비게이션 검증 | spec 06: `name: 'NAT 충전'` |
| `getByRole('button', { name: '…', exact: true })` | 버튼 클릭 (이름 충돌 회피) | spec 03: `name: '등록', exact: true` (트리거 "작품 등록" 과 분리) |
| `getByPlaceholder('…')` | 폼 입력 | spec 03: `getByPlaceholder('작품 제목을 입력하세요')` |
| `getByText(/regex/)` | 동적 값 (NAT 잔량 등) | spec 02 / 06: `/\d+\s*NAT/` (cross-file race 회피) |
| `toHaveAttribute('href', '…')` | Link 도착지 검증 (실 click 우회) | spec 06: `toHaveAttribute('href', '/billing')` |
| `toHaveURL(/regex/)` | 페이지 이동 검증 | spec 00: `/\/login/`, `/\/studio/` |

### 근거

**B1 / B2 / B3 비교 결과**:
- B1 (spec + testid 동일 PR): LEE 일관 룰 위반 — "별도 PR 로 분리 (CLAUDE.md 룰)" + spec 작성과 컴포넌트 수정을 한 commit 에 묶는 격리 위반.
- B2 (role/text 우선, 점진 도입): spec 즉시 가동 + testid 는 컴포넌트 재작성 시 자연스럽게 동시 추가.
- B3 (spec 직후 별도 STEP testid PR): 디자인 개편 코앞이라 곧 깨질 testid 박는 셈, ROI 음수.

**디자인 개편 임박 timing 이 B2 채택의 결정적 요인**:
- `feat/redesign` → `main` PR 직후 디자인 페이즈 1 시작 예정.
- 페이즈 1 (토큰 + atoms) → 페이즈 2 (저위험 랜딩/로그인) → 페이즈 3 (중위험 Studio/Work Detail) → 페이즈 5 (고위험 Analysis Report 머니패스).
- 4 ~ 6 주 후 모든 페이지가 새 컴포넌트로 재작성 — 지금 박은 testid 100 % 갱신 대상.
- 페이즈마다 컴포넌트 재작성 + testid 동시 추가 = ROI ↑.
- **"곧 버려질 코드에 추가 작업 X"** 원칙 (visual baseline 도입 정책 — `docs/redesign/05-visual-baseline-deferred.md` — 와 동일 정신).

---

## Alternatives Considered

### 옵션 B1 — spec 작성과 동시에 `data-testid` 추가 (한 PR 안)
- 동작: 각 spec PR 안에 `data-testid="…"` 추가 + spec 의 `getByTestId` 사용.
- 장점: selector 안정성 ↑ (한국어 카피 변경에 무영향).
- 거부 근거:
  - LEE 룰 — "기능 구현과 selector 추가는 별도 PR 로 분리" (작업 단위 정합성).
  - 디자인 개편으로 곧 컴포넌트 재작성 예정 → 추가한 testid 가 페이즈 1 ~ 2 시점에 사라질 가능성 ↑.
  - 작업 3 의 회귀 슈트 작성 PR 이 production 코드 (consumer 영역) 까지 침범 → CLAUDE.md 격리 정책 회색 지대.

### 옵션 B2 — role / aria / URL / text 우선, testid 디자인 페이즈에 점진 ⭐ 채택
- 동작: 현재 spec 01 ~ 06 처럼 Playwright 의 user-facing locator 우선 사용. testid 는 디자인 페이즈 1 시작 시점에 토큰 / 컴포넌트 재작성과 함께 자연스럽게 도입.
- 장점:
  - selector 추가 비용 0 (현 시점).
  - 디자인 개편으로 곧 사라질 testid 박지 않음.
  - role / text 가 user-facing → spec 가독성 ↑ + 사용자 시나리오 fidelity ↑.
  - visual baseline 도입 정책 (ADR/05-visual-baseline-deferred.md) 과 동조 — 디자인 페이즈 1 합병.
- 비용:
  - 한국어 카피 변경 시 spec 갱신 필요 (디자인 페이즈마다 spec 카피 검토).
  - cross-file race 발생 시 정규식 매처 (`\d+\s*NAT`) 같은 일반화 필요 — 정확값 검증 일부 포기.

### 옵션 B3 — spec 작성 직후 별도 STEP 으로 testid 추가 PR
- 동작: spec 01 ~ 06 작성 직후 다음 STEP 에서 testid 박는 PR 별도.
- 장점: B1 의 "기능 + selector 한 PR" 위반 회피 + selector 안정성 확보.
- 거부 근거:
  - 디자인 개편 코앞 — testid 박은 직후 페이즈 1 시작하면 그 testid 들이 곧 무용.
  - 작업 단위 추가 = 비용 ↑, ROI 음수.

---

## Tradeoffs

받아들인 부담:
- 한국어 카피 변경 (디자인 페이즈 진행 중) 시 spec 갱신 필요 — 페이즈 종료 PR 에 spec 갱신 포함.
- 정확값 검증 일부 포기 (NAT 매처 정규식 일반화 — ADR-0019 cross-file race 회피와 묶여 발생).
- 거대 컴포넌트 (AnalyzePanel.tsx) selector 추출이 어려운 경우, 별도 결정 (현재 spec 04 는 page.request 로 UI 우회 — ADR-0019).

받지 않은 부담:
- 곧 사라질 testid 추가 PR 비용.
- production 코드에 e2e 만 위한 attribute 박는 격리 위반.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- 디자인 페이즈 1 시작 → 토큰 / 컴포넌트 재작성과 함께 testid 점진 도입 (페이즈마다 적용 범위 확장).
- spec 01 ~ 06 의 selector 깨짐 빈도가 한 디자인 페이즈당 3 회 이상 → testid 우선 정책으로 전환 검토.
- 다국어 도입 시 한국어 카피 selector 가 무용 → testid 전면 도입.

---

## Consequences

### 긍정
- 작업 3 회귀 슈트 작성 비용 ↓ (selector 추가 작업 0 — production 코드 0 변경).
- 디자인 페이즈 진행 시 testid 도입 결정이 컴포넌트 재작성과 자연스럽게 통합.
- spec 코드 가독성 ↑ — `getByRole('button', { name: '작품 등록' })` 가 user-facing 의도 명확.

### 영향
- spec 작성자가 매 spec 마다 selector 결정 — 어떤 패턴 (role / text / placeholder / href) 이 적합한지 판단 필요.
- 한국어 카피 변경에 대한 spec 갱신 부담 → 디자인 페이즈 종료 PR 에 spec 갱신 항상 포함하는 정책 필요.
- testid 점진 도입 시점에 ADR-0020 v2 발행 (또는 별도 ADR) 으로 selector 정책 갱신 필요.

---

## Future Work

### 단기
- 디자인 페이즈 1 (토큰 / atoms) 진입 시 spec selector 갱신 필요 부분 식별.
- 페이즈 2 (저위험 페이지) 진입 시 `01-landing.spec.ts` 깨짐 예상 → 동시 갱신 (페이즈 종료 PR 에 묶음).
- 카피 변경 시 spec 갱신을 PR 체크리스트 항목으로 박음.

### 중기 — 페이즈마다 testid 점진 도입
- **페이즈 2**: 랜딩 페이지 컴포넌트 재작성 시 `data-testid` 박기.
- **페이즈 3**: Studio / Work Detail 컴포넌트 재작성 시 박기.
- **페이즈 5**: Analysis Report 컴포넌트 재작성 시 박기 (이때 AnalyzePanel.tsx 분할 가능 — 거대 컴포넌트 해소).
- 모든 페이즈 종료 시점에 spec selector 전체 testid 기반으로 마이그레이션 — 그때 selector 안정성 ↑ + 디자인 변경에도 spec 깨짐 ↓.
- 그 시점에 ADR-0020 v2 (또는 신규 ADR) 발행하여 selector 정책 갱신.

### 중기 — spec 04 UI 우회 보강
- spec 04 가 현재 page.request 로 UI 우회 (ADR-0019). 디자인 페이즈 5 에서 AnalyzePanel 분할 + testid 도입 후 UI 클릭 흐름으로 보강할지 결정.

---

## Related Commits

- `1cb38f4`: feat(redesign): 01 landing + 02 auth-flow 회귀 spec — role/text 패턴 첫 적용.
- `c21b198`: feat(redesign): 03 novel-create 회귀 spec — `getByPlaceholder` + `exact: true` 패턴.
- `6338b5f`: feat(redesign): 06 nat-balance 회귀 spec — `\d+\s*NAT` 정규식 + `toHaveAttribute('href', ...)` 우회 패턴.
- `3a0bd2e`: feat(redesign): 04 analysis-request + 05 report-view — UI selector 우회 (page.request) 결정.

---

## Notes

- ADR-0020 (selector) + ADR/05-visual-baseline-deferred.md (visual baseline) 가 같은 정신 — **디자인 페이즈 1 합병**. 두 결정 모두 "곧 변경될 것에 비용 박지 말자".
- spec 06 의 `toHaveAttribute('href', '/billing')` 패턴은 nav race 회피 + selector 안정성 ↑ 일석이조 — 메뉴 link click 후 URL 변화 race 발생 시 click 자체를 우회하고 href 만 검증.
- spec 03 의 `exact: true` 사용은 "작품 등록" (트리거 버튼) 과 "등록" (모달 submit 버튼) 이름 충돌 회피 — selector 명명 충돌 발견 사례.

### 부속 결정: selector 우선순위 (권장 순서)

1. **`getByRole({ name: '...' })`** — 접근성 표준, 의미 변경 적음.
2. **`getByPlaceholder('...')`** — input 필드, 변경 빈도 낮음.
3. **`getByText('...')`** — 카피 변경 시 깨짐 (디자인 페이즈 위험).
4. **URL 매칭 (`page.waitForURL`, `toHaveURL`)** — 라우트 기반, 가장 안정.
5. **CSS selector / nth-child** — 최후의 수단, DOM 구조 의존.

**안티패턴 (사용 금지)**:
- 정확한 점수 매칭 (예: `'80/100'`) — 디자인 변경 시 표시 형식 바뀔 수 있음.
- CSS class 매칭 — Tailwind / styled-components 변경 시 깨짐.

`exact: true` 사용 기준: 이름 충돌 발견 시 (예: spec 03 의 "작품 등록" 트리거 ↔ "등록" submit 분리).

### 부속 결정: 한국어 카피 selector 회피 패턴
- 정규식 활용 (예: `/작품.*등록|추가/` OR 패턴) — 단기 우회.
- `role + 부분 텍스트` (예: `getByRole('button', { name: /작품/ })`) — 카피 변경에 부분 내성.
- 디자인 페이즈 종료 시 일괄 selector 갱신 (visual baseline 갱신과 동조).
- 정합성: 가드 spec 만 픽셀 baseline + 비즈니스 spec 은 기능 검증 — 디자인 변경 자유 보장.

### 부속 결정: AnalyzePanel.tsx 1000+ 줄 예외 운영
- 페이즈 3 사전 분석에서 거대 컴포넌트 + 하위 모달 다수 (`NatSpendConfirmModal`, `CachedAnalysisChoiceModal`, `ContentUnchangedModal`) 식별 → spec 04 작성 비용 ↑ 예상.
- B2 예외 조항: 페이즈 3-2 spec 04 작성 시점에 selector 추출 어려움 발견 시 LEE 결정 받아 testid 부분 도입 검토.
- **페이즈 3-2 실 진행 결과**: selector 추출 가능 (text/role 매칭으로 우회 + ADR-0019 layered 패턴이 page.request UI 우회로 selector 부담 상쇄). **예외 발동 안 함**, 향후 발동 가능성은 열어둠.
- 의미: B2 가 절대 룰이 아니라 **ROI 기반 가이드**. 명확한 비용 발생 시 우회 가능.
