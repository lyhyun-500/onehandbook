# Visual baseline 도입 보류 결정

## 배경

- 작업 3 페이즈 3-4 시점 (2026-05-09): E2E 회귀 슈트 가동 완료 (7 spec, 20 active tests, 1.7m).
- 페이즈 4 (visual baseline) 진입 결정 시점 도래.

## 결정

visual baseline 도입을 **디자인 페이즈 1 시작 시점으로 보류**.

## 근거

1. baseline 대상 페이지 = 가드 spec 적용 페이지 (랜딩, 로그인 모달).
2. 이 두 페이지가 디자인 개편 페이즈 2에서 가장 먼저 변경 예정.
3. 디자인 토큰 (액센트 컬러, 폰트 등) 미확정 상태에서 baseline 박으면 첫 commit 후 즉시 무용.
4. 디자인 페이즈 1에서 토큰 확정 후 baseline 박기로 합병 — 작업 단위 정합성 ↑.

## 작업 3 종료 시점 상태

| 항목 | 상태 |
|---|---|
| E2E 인프라 (`playwright.config.ts`, `e2e/fixtures/*` 4 파일) | ✅ |
| 가드 회귀 (`00-proxy-guards.spec.ts`, 8/8 통과) | ✅ |
| 비즈니스 회귀 (`01~06.spec.ts`, 12 active tests) | ✅ |
| visual baseline (`e2e/baseline/visual-baseline.spec.ts`) | ⏳ 디자인 페이즈 1로 미룸 |

## 디자인 페이즈 1 시점에 할 작업

- `e2e/baseline/visual-baseline.spec.ts` 신설.
- 가드 페이지 (랜딩, 로그인 모달) 첫 baseline 캡처.
- `npm run test:e2e:baseline` / `npm run test:e2e:update-baseline` 활용.
- 디자인 페이즈 진행 중 의도된 갱신 시점은 페이즈 종료 PR 에 묶음.

## 관련 commit

- 작업 3 페이즈 3-4: `3a0bd2e` — 04 analysis-request + 05 report-view 회귀 spec (직전 spec 5/5 통과).
- 작업 3 페이즈 1: `4fcc48a` — Playwright E2E 인프라 + dev server 환경 격리.
- E2E 전략 박제: `15cfed6` — 03 E2E 회귀 테스트 전략.
