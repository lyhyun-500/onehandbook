# ADR-0016: E2E Playwright 인증 — verifyOtp + 직접 cookie 작성 (PKCE 우회)

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - [docs/redesign/03-e2e-strategy.md](../redesign/03-e2e-strategy.md) — 시드 사용자 전략 결정 시점에 bypass endpoint (옵션 C) 가 보안 위험으로 거부된 선행 사례
  - commit `f6cf9b5` (E2E fixture 보강 — 시드 + 인증 클라이언트)
  - commit `4fcc48a` (Playwright E2E 인프라 + dev server 환경 격리)

---

## Context

### 발견 경위
- 작업 3 페이즈 2 (가드 spec 첫 실행) 시점, writer/admin role storageState 발급이 필요했음.
- 첫 시도: `auth.admin.generateLink({type: 'magiclink'})` 의 `properties.action_link` 를 Playwright 브라우저로 follow → Supabase 가 verify 후 redirect.
- 관찰: redirect URL 이 `http://127.0.0.1:3000/auth/callback#access_token=eyJ...&refresh_token=...&type=magiclink` 형태 — **토큰이 URL fragment** (implicit flow) 로 도착.
- 앱의 `/auth/callback/page.tsx` 는 `useSearchParams().get("code")` (PKCE flow) 만 처리, fragment 토큰은 무시 → 세션 미수립 → storageState 빈 cookies.

### 문제 정의
- Supabase admin API 의 `generateLink` 는 **본질적으로 implicit flow** — PKCE 는 클라이언트 측 codeChallenge 가 필요하므로 admin/server-side 에서 PKCE link 발행 불가.
- 앱의 callback 은 PKCE 전제로 작성되어 있어 fragment 토큰을 처리할 수 없음.
- Playwright fixture 가 writer/admin 세션 cookie 를 안정적으로 확보할 방법이 필요.

---

## Decision

### 결정
**`generateLink` 으로 `properties.hashed_token` 만 추출 → anon client `auth.verifyOtp({token_hash, type: 'magiclink'})` 로 Session 발급 → `@supabase/ssr` 0.9 cookie 포맷 (`base64-` + base64url(JSON.stringify(session))) 으로 storageState JSON 직접 작성.**

### 동작 요약 (`e2e/fixtures/auth.ts` `bootstrapSession` + `buildStorageState`)
1. `auth.admin.createUser` (idempotent — 'already exists' 시 listUsers fallback)
2. `ensureAppUserRow` upsert (auth_id, role, terms/privacy/phone_verified_at)
3. `auth.admin.generateLink({type: 'magiclink'})` 호출하되 **action_link 는 follow 안 함**, `properties.hashed_token` 만 사용
4. `anonClient.auth.verifyOtp({token_hash, type: 'magiclink'})` → Session 객체
5. `sb-<projectRef>-auth-token` 이름으로 cookie value = `base64-` + `Buffer.from(JSON.stringify(session)).toString('base64url')`
6. encoded 길이 > 3180 시 `.0`, `.1` ... 청크 분할 (`@supabase/ssr` `MAX_CHUNK_SIZE` 미러)

### 근거
4가지 옵션 (A 앱 callback 수정 / B bootstrap 라우트 / C CDN @supabase/ssr / D verifyOtp + 수동 cookie) 중 D 만이 다음 세 조건을 동시에 만족:
- production 코드 변경 0건 (CLAUDE.md 격리 정책 + 디자인 페이즈 1 직전 안정성)
- 외부 의존 0 (CDN/네트워크/추가 라우트 없음)
- browser navigation 0 (페이지 cold compile + magic link follow 비용 ~5s 절감)

추가 강점:
- Supabase 공식 admin flow (`generateLink` + `verifyOtp`) 만 사용 — 미래 라이브러리 업그레이드 시 호환성 보장 가능성 ↑
- `@supabase/ssr` cookie 형식만 정확히 맞추면 fixture 자체에서 완결, dev 서버 핫리로드/컴파일과 분리

---

## Alternatives Considered

### 옵션 A — 앱 `/auth/callback` 페이지 수정 (URL fragment 토큰 처리 추가)
- 동작: callback page 에 `window.location.hash` 파싱 + Supabase JS `setSession({access_token, refresh_token})` 호출 분기 추가. PKCE 와 implicit flow 둘 다 처리.
- 장점: e2e 외 일반 사용자에게도 implicit flow 호환 제공. fixture 단순.
- 거부 근거:
  - `/auth/callback` 은 production 사용자의 OAuth 로그인 (Google/Naver) **핵심 경로** — 모든 소셜 로그인 사용자가 무조건 거침.
  - implicit flow fragment 처리 추가 = 기존 PKCE 동작 옆에 분기 신설. 분기 조건 실수 시 일반 OAuth 사용자도 의도치 않게 새 로직 발동.
  - 디자인 개편 페이즈 1 시작 직전 시점 — callback UI/로직 변경의 위험 비율 ↑.
  - **"deprecated implicit flow 를 위해 active 사용자 경로를 건드린다"** 는 정합성 결여.

### 옵션 B — dev 서버에 E2E 전용 bootstrap API 라우트 신설
- 동작: `src/app/api/_e2e/bootstrap-session/route.ts` 신설. `NODE_ENV !== 'production'` + `E2E_BOOTSTRAP_SECRET` 가드. fixture 가 admin signInWithPassword 결과 토큰을 POST → 서버가 `setSession` 으로 정확한 cookie 형식 기록.
- 장점: cookie 포맷 직접 재현 안 함, supabase 라이브러리에 위임.
- 거부 근거:
  - **선행 정책**: `docs/redesign/03-e2e-strategy.md` 시드 사용자 전략 결정 시점에 옵션 C `/api/e2e/sign-in?secret=...` bypass endpoint 가 "보안 위험" 으로 거부됨. bootstrap 라우트는 이름만 다른 동일 본질.
  - LEE 명시 원칙: **"production 코드에 e2e 전용 라우트 박지 않는다"**.
  - 가드 (NODE_ENV/SECRET) 는 공격 표면을 줄일 뿐 0 으로 만들지 않음:
    - production 빌드에서 가드 누락 실수 시 즉시 인증 우회 가능.
    - `E2E_BOOTSTRAP_SECRET` 가 Vercel 환경변수에 잘못 노출되면 production 침해.

### 옵션 C — fixture 에서 CDN(esm.sh) 통해 `@supabase/ssr` 로드 + setSession
- 동작: page.evaluate 안에서 `await import('https://esm.sh/@supabase/ssr@latest')` 후 createBrowserClient 만들고 fragment 토큰을 setSession 으로 처리.
- 장점: production 코드 변경 0.
- 거부 근거:
  - 외부 CDN (esm.sh) 의존 → CDN 다운/응답 지연 시 e2e 회귀 깨짐.
  - CDN `@latest` 와 `package.json` 의 `@supabase/ssr` 버전 drift 위험 — 같은 cookie 포맷이 보장되지 않음.
  - CI 환경에서 외부 네트워크 의존 = flaky 테스트 가능성.
  - 오프라인 개발 시 fixture 작동 불가 (이동 중 / 사내 격리 환경 등).

### 옵션 D — `verifyOtp(hashed_token, 'magiclink')` + 수동 cookie 작성 ⭐ 채택
- 동작: 위 Decision 섹션 단계 1~6.
- 장점: production 코드 변경 0, 외부 CDN 의존 0, browser navigation 0 (browser launch 자체가 fixture 에서 사라져 magic link follow 비용 제거).
- 비용: `@supabase/ssr` 0.9 의 cookie 포맷 (base64url prefix, MAX_CHUNK_SIZE 3180) 을 직접 미러 — 라이브러리 minor 업그레이드 시 검증 필요.

---

## Tradeoffs

받아들인 부담:
- `@supabase/ssr` `utils/chunker.js` `MAX_CHUNK_SIZE = 3180`, `BASE64_PREFIX = 'base64-'`, `cookieEncoding = 'base64url'` 디폴트를 fixture 에 직접 박음 — 의존 dist 코드의 비공개 상수에 결합.
- 라이브러리 업그레이드 시 cookie 포맷 변경 가능성 — 회귀 슈트 첫 실행으로 검증 가능 (fixture 가 invalid cookie 만들면 테스트 즉시 실패).

받지 않은 부담:
- production 코드 변경 0건 (CLAUDE.md 격리 정책 준수).
- 외부 CDN/네트워크 의존 0.
- bypass endpoint 신설 0 (보안 표면 증가 X).

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- `@supabase/ssr` 0.10+ 업그레이드 시 cookie 포맷 변경 (회귀 즉시 fail → fixture 갱신 또는 옵션 재검토).
- Supabase 가 admin `generateLink` 에 PKCE flow 옵션을 정식 지원 시 (현 admin API 에 codeChallenge 파라미터 추가).
- E2E fixture 의 storageState 발급 실패율이 1% 이상으로 관찰될 때.

---

## Consequences

### 긍정
- E2E 슈트가 매 실행마다 deterministic 하게 writer/admin 세션 cookie 확보 (1.7m 전체 회귀 0.1s 정도가 fixture 비용).
- `getAuthenticatedClient(role)` 추가로 NAT pipeline 같은 사용자 권한 RPC 직접 호출 가능 (spec 04 test 2 패턴).

### 영향
- 향후 신규 e2e role 추가 시 같은 패턴 재사용 (예: admin 외 BFF service account 등).
- Supabase 라이브러리 업그레이드 PR 에 e2e 회귀 통과를 게이트로 둠으로써 cookie 포맷 변경 자동 감지.

---

## Future Work

### 단기
- `@supabase/ssr` 라이브러리 업그레이드 시 cookie 형식 호환성 회귀 검증 필수.
  - 현재 의존 형식: `sb-<projectRef>-auth-token` = `base64-` + `base64url(JSON.stringify(session))`, MAX_CHUNK_SIZE 3180.
  - 메이저 버전 업 시 `e2e/fixtures/auth.ts` 의 `buildStorageState` + `createSsrCookieChunks` + `COOKIE_CHUNK_SIZE` 동작 확인 + 필요 시 cookie 형식 조정.

### 중기
- 다른 e2e role 추가 시 동일 패턴 재사용 (예: editor 권한 등).
- staging 환경 도입 시 verifyOtp 패턴 staging 적용 가능성 검토.
- Playwright parallel test workers 증가 시 시드 user 충돌 회피 정책 (현재 단일 e2e_test_writer / e2e_test_admin 공유 — spec 04 처럼 NAT 조작 시 경합 발생 가능성. 이미 `mode: 'serial'` 로 부분 회피).

---

## Related Commits

- `4fcc48a`: feat(redesign): Playwright E2E 인프라 + dev server 환경 격리 (초기 magic link follow 시도 / 실패 흐름)
- `f6cf9b5`: feat(redesign): E2E fixture 보강 — 시드 + 인증 클라이언트 (`bootstrapSession` + `buildStorageState` + `getAuthenticatedClient` 최종 형태)
- `1cb38f4`: feat(redesign): 01 landing + 02 auth-flow 회귀 spec (writer fixture 첫 실 사용)
- `3a0bd2e`: feat(redesign): 04 analysis-request + 05 report-view 회귀 spec (`getAuthenticatedClient` 가 NAT RPC 직접 호출에 사용)

---

## Notes

- 이번 세션 페이즈 2 진행 중 4가지 옵션을 LEE 와 토론하며 D 채택. 옵션 비교는 위 Alternatives Considered 섹션 참조.
- `@supabase/ssr` 내부 `MAX_CHUNK_SIZE` 미러는 `e2e/fixtures/auth.ts` 의 `COOKIE_CHUNK_SIZE` 상수 + 주석 ("keep in sync on dep upgrade") 으로 가시화.
