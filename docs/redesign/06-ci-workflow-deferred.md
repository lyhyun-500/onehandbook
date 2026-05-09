# CI workflow 도입 보류 결정

## 배경

- 작업 4 페이즈 4-5 시점 (2026-05-09): 안전망 인프라 + ADR (6 건) + 운영 문서 (README / CONTRIBUTING / 00-current-state) 박제 완료.
- E2E 회귀 슈트 가동 (`npm run test:e2e:regression` 한 줄, 7 spec / 20 active tests / ~1.7m).
- CI workflow (`.github/workflows/e2e.yml`) 도입 결정 시점 도래.

## 결정

CI workflow 도입을 **보류** 하고 운영 시점에 재결정.

## 근거

1. **1 인 운영 환경** — PR 빈도 낮음, local 실행이 사실상 CI 역할.
2. **회귀 슈트 ~1.7m** — LEE 가 매 변경마다 수동 실행 부담 적음 (background 실행 + 다른 작업 병행 가능).
3. **CI 도입 시 결정 사항 8 개** — 작업 4 종료 후 별도 PR 단위로 처리하는 게 정합 (지금 묶으면 작업 4 commit split 어지러워짐).
4. **현재 함정 우선** — 디자인 페이즈 1 진입 + 안전망 가동에 우선순위.

## 보류 정책

### 적용 트리거 (어느 시점에 도입)
- **협업자 영입 시** (PR 작성자가 LEE 가 아닌 경우 → local 실행 강제 불가).
- **PR 빈도 ↑** (주 5 건 이상 등 — 수동 실행 비용이 누적되는 시점).
- **E2E 회귀 실수 누락 사고 발생 시** — local 실행을 빠뜨려 회귀가 main 에 박힌 사고 1 회 라도 발생하면 즉시 도입.

### 트리거 미충족 동안
- 매 변경마다 LEE 가 `npm run test:e2e:regression` 수동 실행.
- 결과 통과 확인 후 commit / PR.

## 도입 시 결정 필요 사항 (사전 분석 박제)

### 1. 트리거 정책
- PR 단위 (회귀 전체) + main push 단위 (smoke).
- **권장**: PR 단위 회귀 + main push smoke (PR 마다 1.7m 비용은 감당 가능, main push 는 빠른 피드백 우선).

### 2. Node 셋업
- `actions/setup-node` + `npm ci` (표준).

### 3. Playwright 브라우저
- `npx playwright install chromium --with-deps` + cache key (browser binary 재다운로드 방지).
- **권장**: cache 적극 사용 (~150MB/run 절약).

### 4. E2E env secrets
- GitHub Secrets 에 `E2E_*` 5 개 등록:
  - `E2E_SUPABASE_URL`
  - `E2E_SUPABASE_ANON_KEY`
  - `E2E_SUPABASE_SERVICE_ROLE_KEY`
  - `E2E_TEST_WRITER_EMAIL`
  - `E2E_TEST_ADMIN_EMAIL`
- **`service_role` 노출 신중** — repo secret + 권한 최소화 (E2E project 한정 service_role, PROD 와 분리).

### 5. Schema sync
- CI 매 회 `replicate-supabase-schema.sh` 실행은 **불필요** — schema 는 사전 setup, CI 는 read-only 가정.
- schema 변경 시점에만 LEE 가 local 에서 1 회 실행.

### 6. ANTHROPIC_API_KEY
- **fake** (`sk-ant-e2e-fake`) — `webServer.env` 통해 주입, 비용 0.
- spec 04 background worker 가 fake key 로 fail (의도됨 — ADR-0019 의 3 계층 분리로 검증은 RPC 직접 호출 경로에서 확보).

### 7. HTML report 업로드
- `actions/upload-artifact` (`if: always()`, 실패 분석용).

### 8. 알림
- Slack/Discord notify 는 1 인 운영이라 효용 낮음.
- 협업자 영입 시 추가 검토.

## 잠재 차단 사항 (도입 시 주의)

- **CI runner 에 `libpq` 미설치** — schema 사전 setup 필요 시 별도 step (`apt-get install libpq-dev` 또는 brew).
- **E2E Supabase redirect URL** — `verifyOtp` 는 admin API + 직접 cookie 라 redirect 거치지 않으므로 GitHub runner IP 등록 **불필요** (ADR-0016 패턴 그대로 동작).
- **동시 PR 병렬 접근** — `e2e_test_writer` 공유로 데이터 충돌 가능.
  - **대응 옵션**:
    - PR 마다 분리된 E2E project (비용 ↑ + 셋업 부담 ↑).
    - 시드 user prefix 분리 (예: `e2e_test_writer_<github_run_id>@...`) — 권장.

## 관련 문서

- **ADR-0017**: webServer.env override (CI 환경에서도 동일 패턴 — env 주입 위치만 GitHub Actions 의 `env:` 로 옮김).
- **ADR-0019**: spec 계층 분리 (CI flakiness 시 retry 정책 영향 — `retries: process.env.CI ? 2 : 1` 이미 박힘).
- **ADR-0021**: Long-running task 박제 정책 (CI 도입 작업 자체가 적용 사례 — 다단계 mini-task).
- [`docs/redesign/05-visual-baseline-deferred.md`](./05-visual-baseline-deferred.md) (같은 보류 패턴).

## Future Work

### 단기
- CI 도입 트리거 발생 시 별도 PR 로 처리.
- 명령서 박제 (`docs/redesign/MINI-ci-workflow.md`, ADR-0021 적용 — 위 8 개 결정 사항을 명령서 단계로 분해).

### 중기
- CI 도입 후 ADR 승격 검토 (ADR-0022 후보).
- 동시 PR 충돌 정책 결정 (분리 project vs 시드 prefix — 협업자 영입 시점에 결정).
