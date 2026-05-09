# ADR-0017: E2E webServer.env override + reuseExistingServer:false (PROD/E2E 격리)

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - [ADR-0016](./ADR-0016-e2e-auth-verifyotp-cookie.md) — 한 쌍. 인증 (0016) 이 작동하려면 환경 격리 (이 ADR) 가 선결.
  - [docs/redesign/03-e2e-strategy.md](../redesign/03-e2e-strategy.md)
  - commit `4fcc48a` (Playwright E2E 인프라 + dev server 환경 격리)

---

## Context

### 발견 경위
- 작업 3 페이즈 1 시점, e2e 전용 Supabase 프로젝트 (`zejrznynbmnfatghisjq`) 와 production 프로젝트 (`ystxvlibeqdrlnsriidh`) 분리는 이미 결정된 상태 (`docs/redesign/04-e2e-supabase-replication-report.md` 참조).
- `.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 는 일상 `npm run dev` 사용성을 위해 PROD 값으로 설정.
- Playwright fixture 는 `E2E_SUPABASE_*` 환경변수로 E2E 프로젝트에 admin API 호출.
- **페이즈 2-3 첫 실행** 에서 writer/admin fixture 시나리오 4 개가 "Invalid API key" 로 실패. 가드 시나리오 3 개 (비로그인) + `/dev/flags` + `/dashboard` 는 통과 — **fixture 가 admin API 호출하는 시나리오만 실패** → fixture 인증 경로 의심.
- 진단: `NEXT_PUBLIC_SUPABASE_URL = ystx...` (PROD ref), `E2E_SUPABASE_URL = zejr...` (E2E ref) → 미스매치 확인.
- 원인: dev server 가 `.env.local` 의 PROD 변수 로드, fixture 가 E2E project 로 발급한 세션 cookie 를 dev server 가 PROD project 로 검증 시도하여 거부.

### 문제 정의
- dev 서버를 e2e 실행 동안 **E2E 프로젝트로 가리키게** 해야 fixture 발급 cookie 가 검증됨.
- 동시에 LEE 의 일상 `npm run dev` (PROD 데이터로 수동 검증) 워크플로우는 보존되어야 함.
- `.env.local` 직접 수정은 사고 (PROD 값 영구 덮어쓰기) 위험 + 사용자 부담 ↑.

---

## Decision

### 결정
**`playwright.config.ts` 의 `webServer.env` 블록에서 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SITE_URL` 를 `E2E_*` 값으로 명시 override + `reuseExistingServer: false`.**

### 동작 요약 (`onehandbook/playwright.config.ts`)
```ts
webServer: {
  command: 'npm run dev',
  url: baseURL,
  reuseExistingServer: false,           // ← 항상 새 dev server, env override 보장
  env: {
    ...inheritedEnv,                    // process.env 상속 (dotenv 로드된 .env.local 포함)
    NEXT_PUBLIC_SUPABASE_URL:        process.env.E2E_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:   process.env.E2E_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY:       process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
    NEXT_PUBLIC_SITE_URL:            baseURL,
    ANTHROPIC_API_KEY:               'sk-ant-e2e-fake-not-real',
  },
}
```

추가 가드: config 시작 시 `REQUIRED_ENV` (5개) 누락 즉시 throw — 사용자가 `.env.local` 에 E2E 변수를 설정하지 않으면 첫 줄에서 명시적 실패.

### 근거
- `.env.local` 은 그대로 둠 → LEE 의 일상 `npm run dev` 는 PROD 검증으로 계속 작동.
- e2e 실행은 Playwright 가 자체 spawn 한 dev server 한정으로 E2E 프로젝트 가리킴 → 격리 + 자동.
- ADR-0016 의 verifyOtp + cookie 패턴이 PROD/E2E 미스매치 없이 검증 통과.

---

## Alternatives Considered

### 옵션 A — `.env.test.local` 분리 (Next.js 관례)
- 동작: `NODE_ENV=test` 로 dev server 기동 → Next.js 가 `.env.test.local` 자동 로드 (PROD 값 무시).
- 장점: Next.js 공식 관례, 추가 코드 0.
- 거부 근거:
  - `NODE_ENV=test` 는 e2e 무관한 부작용을 유발:
    - CSS minification 비활성화 (빌드 결과 다름).
    - React 일부 dev 모드 동작 변경.
    - 서드파티 라이브러리 일부가 `NODE_ENV` 에 따라 다른 코드 경로 분기.
  - **e2e 의 목적 = production 동작 검증**. `NODE_ENV=test` 가 production 과 다른 분기를 발동시키면 검증 가치 ↓.
  - `webServer.command` 에 `NODE_ENV=test` 명시 + 별도 dev script 분기 + cross-env 도구 의존 = 복잡도 ↑.

### 옵션 B — 환경 토글 수동 스왑 (LEE 가 e2e 전 `.env.local` 의 NEXT_PUBLIC_* 를 E2E 값으로 교체)
- 동작: e2e 세션마다 LEE 가 직접 4 변수 교체, 끝나면 PROD 값으로 복구.
- 장점: 도구 변경 0.
- 거부 근거:
  - 사용자 부담 ↑ (매 회 수동 교체 + 복구).
  - 사고 위험: 복구 누락 시 production 값 영구 손상.
  - Claude Code 자동 회귀와 충돌 (LEE 개입 없이 e2e 못 돌림).

### 옵션 C — webServer.env override + reuseExistingServer:false ⭐ 채택
- 동작: 위 Decision 섹션.
- 장점:
  - `.env.local` 무변경 → 일상 dev workflow 보존.
  - dev server env 가 e2e 실행에 한해 자동 override.
  - REQUIRED_ENV 가드로 누락 즉시 명시적 실패.
- 비용: `reuseExistingServer: false` 라 매 e2e 실행마다 dev server cold start (~5초 추가 + Next.js webpack 컴파일 캐시 미사용).

---

## Tradeoffs

받아들인 부담:
- 매 e2e 실행마다 dev server cold start ~5~10s (전체 슈트 1.7m 의 ~5~10%, 수용 가능).
- `reuseExistingServer: true` (default 동작) 일 때 첫 시도에서 발견된 함정: Playwright 가 LEE 가 띄운 기존 dev server (PROD env 로) 를 재사용 → `webServer.env` override 자체가 무시됨 → 인증 실패. **false 강제** 로 회피.
- LEE 가 별도 터미널에 dev server 띄워두는 워크플로우 사용 시, e2e 실행 전 그 dev server 종료 필요 (작은 부담).

받지 않은 부담:
- `.env.local` 직접 수정 부담.
- `NODE_ENV=test` 모드 전용 코드 분기.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- e2e 슈트 cold start 비용이 1분 이상으로 커지면 → port 분리 (e2e 전용 3001 dev server) 또는 `.env.test.local` 재검토.
- Next.js 가 미들웨어 단계에서 환경 격리를 공식 지원 (예: 빌드 모드별 env profile) → 그 패턴으로 이전.
- LEE 일상 dev workflow 가 변경되어 PROD 값 .env.local 보존 가치가 사라지면.

---

## Consequences

### 긍정
- ADR-0016 verifyOtp 인증이 안정적으로 작동 (PROD/E2E 미스매치 0).
- 일상 dev (`npm run dev`) workflow 무영향.
- REQUIRED_ENV 가드로 신규 dev 환경 셋업 시 누락 즉시 발견.

### 영향
- e2e 회귀 첫 실행 시 dev server cold start ~5s 비용 (반복 실행 시 캐시 무용 — `reuseExistingServer: false` 의존).
- 신규 dev 환경 셋업 가이드에 `E2E_*` 5 변수 + `.env.local` 추가 절차 박제 필요 (CONTRIBUTING.md 작성 시점에 반영).

---

## Future Work

### 단기
- 페이즈 3-2 spec 04 ECONNRESET 1 회 사례 — dev server 부하 기인 추정. 추가 발생 시 `workers: 2` 또는 `retry: 2` 검토.
- CI 환경에서 `retries: 2` (현재) 와 `workers` 제한 (현재 default 4) 균형 모니터링.

### 중기
- Playwright `workers > 1` 또는 mobile/firefox project 추가 시 단일 dev server 처리 능력 한계 검토 → 그때는 port 분리 (e2e 전용 3001) 또는 dev server 클러스터 도입 검토.
- staging 환경 도입 시 staging URL 을 추가 webServer 분기로 처리 가능 (`webServer: [{...3000}, {...3001 staging}]` 등 멀티 선언).
- Vercel preview 에서 e2e 실행 도입 시 — webServer.env override 가 무의미해짐 (Vercel 에서 띄운 preview 는 자체 env). 이때는 preview URL 자체를 `baseURL` 로 사용하는 패턴 검토 필요 (webServer 자체 비활성).

---

## Related Commits

- `4fcc48a`: feat(redesign): Playwright E2E 인프라 + dev server 환경 격리 (이 ADR 의 코드 본체)
- `f6cf9b5`: feat(redesign): E2E fixture 보강 — 시드 + 인증 클라이언트 (ADR-0016 + 이 ADR 한 쌍의 사용처)
- `3a0bd2e`: feat(redesign): 04 analysis-request + 05 report-view 회귀 spec (`ANTHROPIC_API_KEY=sk-ant-e2e-fake-not-real` env override 추가 시점)

---

## Notes

- "E2E 격리" 결정은 ADR-0016 (인증) 과 한 쌍. 이 ADR 만 적용하고 ADR-0016 미적용 시 — fixture 가 cookie 발급 못함. ADR-0016 만 적용하고 이 ADR 미적용 시 — cookie 발급은 되지만 dev server 가 PROD 로 검증해 인증 실패. **두 ADR 모두 필수**.
- `ANTHROPIC_API_KEY: 'sk-ant-e2e-fake-not-real'` 도 같은 webServer.env 블록 — 별도 ADR-0019 (E2E spec 계층 분리) 에서 상세.

### 부속 결정: 포트 정책 (3000 단일)
e2e 전용 포트 분리 (3001) 도 검토했으나 거부:
- 3001 옵션의 부담:
  - Supabase Site URL / Redirect URL 에 `:3001` 추가 등록 필요.
  - `baseURL` 분기 (수동 dev 은 3000, e2e 은 3001) 로 코드 복잡도 ↑.
  - Vercel preview / production 과 일관성 X (둘 다 3000 또는 production URL 사용).
- 3000 단일 + `reuseExistingServer: false` 의 부담:
  - Supabase 설정 0 변경.
  - LEE 가 띄운 별도 dev server 를 e2e 실행 전 종료 필요 (작은 부담).
  - cold start 5~10 초 추가.
- **결정**: 3000. Supabase 추가 설정 0 의 가치 ↑.
