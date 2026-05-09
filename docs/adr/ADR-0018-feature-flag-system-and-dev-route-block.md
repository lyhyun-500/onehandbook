# ADR-0018: Feature flag 시스템 (7 flag) + /dev/* production 차단

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - [docs/redesign/00-current-state.md](../redesign/00-current-state.md) — 진단 리포트
  - [docs/redesign/02-route-inventory.md](../redesign/02-route-inventory.md) — 라우트 인벤토리 + proxy.ts 가드 매트릭스
  - [docs/troubleshooting/TS-002-nextpublic-env-dynamic-access.md](../troubleshooting/TS-002-nextpublic-env-dynamic-access.md) — `NEXT_PUBLIC_*` literal access 교훈
  - commit `495aa4b` (Feature flag 시스템 + /dev/* 차단 구현)
  - commit `cb0be97` (proxy.ts 존재 반영하여 진단 리포트 정정 — 선행)

---

## Context

### 발견 경위
- 디자인 전면 개편 (랜딩/스튜디오/작품상세/작품분석/가격/결제/계정 7 페이지) 안전망 구축 필요.
- 구버전과 신버전을 같은 production 코드 베이스에 공존시키며 **점진적 마이그레이션 (Strangler Fig)** 적용 결정.
- 페이지 단위 토글 + production 보호 + 디버깅 가시성 필요.
- 작업 1 (git 태그 + 진단) 종료 후 작업 2 단계로 진입.

### 문제 정의
- 디자인 신/구 페이지를 한 production 빌드에서 분기 가능해야 함 (페이지 단위 점진 출시).
- production 사용자에게는 신버전 노출 미리 안 됨 (LEE 가 명시 토글 전).
- 개발자 (LEE 1 인) 가 production / preview / 로컬 어디서든 신버전을 빠르게 미리보기 가능해야 함.
- 구현 자체가 production 보안 표면을 키우면 안 됨 (토글 UI 가 production 노출되면 우회 가능성).

---

## Decision

### 결정
**7 flag (landing/studio/work-detail/work-analysis/pricing/billing/account) + 4-tier priority (`query > cookie > env > false`) + `/dev/flags` 토글 UI + `/dev/*` production 차단 (proxy.ts 분기).**

### 동작 요약

#### Flag 7 종 (admin 은 별도 트랙)
```ts
type RedesignFlag =
  | "landing" | "studio" | "work-detail" | "work-analysis"
  | "pricing" | "billing" | "account";
```
admin 은 별도 ADR/트랙 (v2) — 디자인 개편 범위 외.

#### 평가 우선순위 (`src/lib/feature-flags.ts:evaluateRedesignFlag`)
1. **Query string** `?newui=<flag>` | `?newui=all` | `?newui=off` — 1 회 미리보기 / off 강제
2. **Cookie** `newui_flags=<flag>,<flag2>...` (콤마 구분) | `newui_flags=all` — 30 일 sticky (`/dev/flags` 토글)
3. **Env var** `NEXT_PUBLIC_REDESIGN_<NAME>=true` — 빌드 단위 토글
4. **Off** (default) — 구버전

각 평가 결과에 `source` 필드 동반 (`"query" | "cookie" | "env" | "off"`) — 디버깅용.

#### Wrapper 분리 (Server vs Client 격리)
- `feature-flags.ts` — 순수 평가 + types + `ENV_FLAGS` record (환경 무관).
- `feature-flags-server.ts` — RSC/Server Action/Route Handler 용 (`cookies()` 사용).
- `feature-flags-client.ts` — Client Component 용 (`useSearchParams` 사용).
- 잘못된 import 시 빌드 에러 (`next/headers` 제약).

#### `ENV_FLAGS` literal access record (TS-002 교훈)
```ts
const ENV_FLAGS: Record<RedesignFlag, string | undefined> = {
  landing: process.env.NEXT_PUBLIC_REDESIGN_LANDING,
  studio: process.env.NEXT_PUBLIC_REDESIGN_STUDIO,
  // ... 7 개 모두 literal
};
```
- `NEXT_PUBLIC_*` 는 webpack DefinePlugin 이 **literal access 만** inline.
- `process.env[name]` (dynamic key) → client bundle 에서 undefined 가 됨 (TS-002 사고).
- 7 flag 를 record 로 박아두어 dynamic key 접근 자체를 컴파일 타임에 막음.

#### `/dev/flags` 토글 UI
- `src/app/dev/flags/page.tsx` (RSC entry) + `DevFlagsClient.tsx` (토글).
- `force-dynamic` 으로 prerender skip — env/cookie 변경에 즉시 반응.
- 출처 디버깅 표 노출 (각 flag 의 `source` 값 표시).

#### `/dev/*` production 차단 (`src/proxy.ts:37`)
```ts
if (path.startsWith("/dev/") && process.env.NODE_ENV === "production") {
  return NextResponse.redirect(new URL("/", request.url));
}
```
- production / Vercel preview (둘 다 NODE_ENV=production) 에서 `/dev/flags` 접근 시 즉시 `/` 로 redirect.
- 토글 UI 자체가 production 사용자에게 노출 안 됨 → 우회 표면 0.

### 근거

**7 flag 분할 — 디자인 시안 핸드오프의 위험도 매트릭스 기반**:
- 핸드오프 페이지 목록 (랜딩 / 로그인 모달 / 스튜디오 / 작품 상세 / 작품 분석 / 가격 / 결제) 의 페이지 라우트 단위 자연 경계 → 7 flag 로 분할 (로그인 모달은 landing 흐름에 통합, account 추가).
- 각 페이지가 디자인 페이즈 1 ~ 5 에서 독립적으로 변경됨 — 한 페이지 깨져도 다른 페이지에 영향 없게 격리.
- `/admin` 은 별도 트랙 (admin 페이지는 일반 사용자 흐름과 무관, CLAUDE.md 의 작업 도구 분리 정책 — Cursor / Claude Code).
- 분할 단위 비교:
  - 5 개: 너무 거친 분할, 동일 페이즈 안 여러 페이지 토글 불가.
  - 10 개: 과도한 세분화, 컴포넌트 단위 토글까지 가면 관리 부담 ↑.
- **7 개가 페이지 라우트 단위 자연 경계**.

**4-tier priority (`query > cookie > env > false`) — 사용 패턴 기반 우선순위**:
- **Query** (1 회성 미리보기): PR review / QA / 단발성 검증. 가장 즉시성 높아 최우선.
- **Cookie** (세션 영속): `/dev/flags` UI 에서 설정. 개발자 본인 작업 세션 30 일 유지.
- **Env** (빌드 타임 기본값): development / preview / production 별 다른 기본값.
- **False** (default): 위 셋 다 없으면 비활성.
- 의도: **일회성 → 세션 → 환경 → 기본** 순서가 직관적. 한 페이지를 미리보고 싶을 때 query 한 번으로 해결, 본인 작업 세션은 cookie, 팀/배포 단위는 env.

---

## Alternatives Considered

### 옵션 A — LaunchDarkly 같은 SaaS Feature Flag 도입
- 동작: 외부 SaaS 가입 + SDK 도입 + 대시보드에서 flag 토글 + targeting.
- 장점: 즉시 토글 / A/B / 사용자 그룹 등 풍부한 기능.
- 거부 근거:
  - **1 인 운영 비용 ↑** (월 $$, free tier 제한).
  - 디자인 개편 끝나면 flag 제거. 1 회성 도입에 SaaS dependency over-kill.
  - SDK 가 client bundle 추가 + 첫 로드 시 외부 호출 → 페이지 성능 영향.

### 옵션 B — 빌드 타임 분기 (`NEXT_PUBLIC_REDESIGN_*` 환경변수 only, 런타임 토글 X)
- 동작: 환경변수 `=true` 만으로 신버전 노출. cookie/query 토글 없음. 변경 시 rebuild.
- 장점: 구현 가장 단순. 외부 의존 0.
- 거부 근거:
  - LEE 가 production 에서 신버전 미리보기하려면 매번 deploy.
  - cookie sticky 가 없어 미리보기 후 화면 닫으면 다시 구버전 — A/B 비교 어려움.
  - production 에서 뭔가 잘못 보일 때 즉시 끌 방법 = redeploy.

### 옵션 C — 단일 `NEXT_PUBLIC_REDESIGN_ENABLED` 글로벌 플래그
- 동작: flag 1 개로 신/구 전체 분기.
- 장점: 관리 복잡도 최소.
- 거부 근거:
  - 페이지 단위 점진 출시 불가 — 7 페이지 모두 동시 신버전 또는 모두 구버전.
  - 디자인 페이즈 1 (랜딩) 만 먼저 검증 → flag-on → 다른 6 페이지 신버전이 미완성 상태로 노출.
  - Strangler Fig 패턴의 핵심 (페이지 단위 격리) 깨짐.

### 옵션 D — 7 flag + 4-tier priority + /dev/* production 차단 ⭐ 채택
- 동작: 위 Decision 섹션.
- 장점:
  - 페이지 단위 점진 출시 (디자인 페이즈마다 1 flag 씩 flip).
  - LEE 가 production 에서 query string 으로 1 회 미리보기 가능 (`?newui=studio`).
  - cookie 30 일 sticky 로 LEE 의 지속 미리보기 가능, 일반 사용자에게는 노출 안 됨.
  - 환경변수로 빌드 단위 토글도 가능.
  - `/dev/flags` 가 production 차단되어 토글 UI 우회 표면 0.
- 비용: 7 flag 관리 복잡도 + wrapper 3 파일 분리 + ENV_FLAGS record 패턴 학습 비용.

---

## Tradeoffs

받아들인 부담:
- 7 flag record + 3 wrapper 파일 (feature-flags{,-server,-client}.ts) 코드 유지.
- 디자인 개편 종료 후 cleanup 필수 (flag 제거 + 구버전 코드 삭제) — [LEE 보충 필요 — 정확한 cleanup 정책]
- 신규 flag 추가 시 7 곳 (type / array / ENV_FLAGS / .env.local.example / DevFlagsClient UI 등) 갱신.

받지 않은 부담:
- 외부 SaaS 의존 / client bundle 증가.
- 매 토글마다 redeploy.
- production 에 토글 UI 노출 위험.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- 디자인 개편 종료 → flag 전부 제거 (이 ADR 도 Deprecated 로 표기).
- 신규 flag 가 10 개 초과 → 7 곳 갱신 비용이 한계 → record 자동 생성기 또는 SaaS 검토.
- production 사용자 그룹 별 점진 출시가 필요 (예: 베타 사용자 50 % → 100 %) → SaaS 검토.

---

## Consequences

### 긍정
- 디자인 페이즈 1 부터 페이지 단위 안전망 확보.
- LEE 의 production 미리보기가 deploy 없이 즉시 가능.
- ENV_FLAGS record 패턴이 TS-002 사고 재발 방지.
- `/dev/*` 차단 정책이 향후 다른 dev tool 추가 시도 (e.g., `/dev/db`, `/dev/jobs`) 에 자동 적용.

### 영향
- `proxy.ts` 의 `/dev/*` 분기는 향후 모든 dev tool 의 단일 진입점 (분산 가드 안 함).
- 디자인 개편 페이즈마다 flag flip + 회귀 검증 사이클 정착.
- ADR-0017 (E2E webServer.env override) 의 `NODE_ENV` 검증과 같은 가드 메커니즘 (proxy.ts) 사용 — 일관성 ↑.

---

## Future Work

### 단기
- 페이즈 진행 중 flag toggle 부주의 사고 방지: PR 마다 flag 상태 명시 체크리스트 추가.
- `/dev/flags` UI 에 현재 cookie / env 상태 시각화 보강 (현재는 source 표시 정도, 추가 디버깅 정보 가능).

### 중기 — 디자인 개편 종료 후 flag cleanup
다음 5 단계 일괄:
1. `.env.local.example` 의 `NEXT_PUBLIC_REDESIGN_*` 7 개 변수 제거.
2. `src/lib/feature-flags{,-server,-client}.ts` 3 파일 제거.
3. 신구 분기 코드를 새 코드로 통합 (구버전 코드 제거).
4. `src/app/dev/flags/page.tsx` + `DevFlagsClient.tsx` 제거.
5. `src/proxy.ts` 의 `/dev/*` 차단 분기 제거 (또는 다른 dev tool 추가 시 유지 검토).

### 중기 — 다른 점진 마이그레이션 패턴 재사용
- 향후 다른 점진 마이그레이션 (예: 백엔드 리팩토링) 시 동일 4-tier priority + `/dev/*` 차단 패턴 재사용 가능.
- LaunchDarkly 같은 SaaS 는 1 인 운영 끝까지 도입하지 않음 (비용 정합성 X).
- admin 영역 v2 트랙 진입 시 flag 추가 패턴 (또는 별도 메커니즘) 결정.

---

## Related Commits

- `495aa4b`: feat(redesign): /dev/* production 차단 + Feature flag 시스템 (7개) — 이 ADR 본체.
- `cb0be97`: docs(redesign): proxy.ts 존재 반영하여 진단 리포트 정정 — Next.js 16 의 middleware → proxy 이름 변경 발견 후 진단 doc 정정 (선행 결정).

---

## Notes

- **proxy.ts 발견 함정**: 작업 1 진단 시 `middleware.ts` 만 검색해서 `proxy.ts` (이미 175 줄 가드) 누락. 작업 2 진입 시 `middleware.ts` 신설 시도 → 빌드 실패 메시지 `Both middleware file ./src/middleware.ts and proxy file ./src/proxy.ts are detected` 로 proxy.ts 존재 발견. Next.js 16 에서 `middleware` → `proxy` 이름 변경 (production 이미 사용 중). `middleware.ts` 삭제 + `proxy.ts` 에 `/dev/*` 차단 한 줄 추가 결정 → 진단 정정 commit (cb0be97 docs) + 구현 commit (495aa4b feat) 분리.
- **TS-002 교훈**: `process.env[name]` 같은 dynamic key 는 webpack DefinePlugin 이 inline 못 한다. 본 ADR 의 `ENV_FLAGS` record 가 그 사고 재발을 컴파일 타임에 막음.
- **admin 영역 별도 트랙**: 디자인 개편 7 페이지에 admin 미포함. admin 은 작업 환경 (Cursor / Claude Code 분리 — CLAUDE.md) + UI 구조 자체가 다름.

### 부속 결정: `/dev/*` 차단 위치 (page-level vs middleware)
- **옵션 P1 — Page-level 가드** (`src/app/dev/flags/page.tsx` 자체에 `if (NODE_ENV === 'production') notFound()`):
  - server / client 컴포넌트 분리 복잡도 ↑.
  - 새 `/dev/*` 페이지 추가할 때마다 가드 코드 반복 필요.
- **옵션 P2 — Middleware 차단** (`proxy.ts` 의 `/dev/*` pattern 단일 분기) ⭐ 채택:
  - 한 번 박으면 미래 `/dev/*` 추가도 자동 차단.
  - 이미 `proxy.ts` 에 path 기반 분기 패턴 정착되어 있음 (`/dashboard` → `/studio` redirect 등).
- **결정**: P2 — proxy.ts 한 줄 추가.

### 부속 결정: 페이즈별 flag flip 운영 시나리오
- **페이즈 1**: 토큰 + 공통 atoms — flag 없이 (전 페이지 영향, 비파괴 변경).
- **페이즈 2**: 저위험 페이지 (랜딩 / 로그인 모달 / 스피너) → `NEXT_PUBLIC_REDESIGN_LANDING=true` 활성.
- **페이즈 3**: 중위험 (Studio / Work Detail) → `NEXT_PUBLIC_REDESIGN_STUDIO`, `NEXT_PUBLIC_REDESIGN_WORK_DETAIL` 활성.
- **페이즈 5**: 고위험 (Analysis Report 머니패스) → 가장 마지막 활성.
- 운영 흐름:
  1. 페이즈 시작 시 해당 flag 만 `false` → `true` 전환.
  2. 신/구 코드 동시 존재, flag 로 분기.
  3. 페이즈 종료 후 충분한 검증 거쳐 flag 영구 `true` (env 기본값) 전환.
  4. 모든 페이즈 종료 후 flag 자체 제거 (Future Work cleanup 5 단계).
