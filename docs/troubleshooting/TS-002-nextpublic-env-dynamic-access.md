# TS-002: NEXT_PUBLIC_* dynamic env access — production /pricing 다운

## 메타

| 항목 | 내용 |
|---|---|
| 발생일 | 2026-05-07 |
| 영향 범위 | `/pricing` 페이지 (production 진입 불가) |
| 영향 기간 | 2026-05-06 ~ 2026-05-07 (paddle wire-up 배포 ~ fix 배포, 약 1일) |
| 해결 시간 | 약 1시간 (LEE 인지 → fix 배포) |
| 심각도 | High (결제 진입 페이지 전면 다운, 다만 베타 단계라 즉시 매출 손실 0) |
| 후속 작업 | [P2-007 (backlog)](../backlog.md) — 코드베이스 잔존 dynamic access 패턴 전수 점검 |

---

## 증상

- `/pricing` 접속 시 "일시적 오류" 화면, 페이지 자체가 렌더링 안 됨
- 브라우저 콘솔:
  ```
  Uncaught (in promise) Error: [paddle] 환경변수 누락: NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY
      at u (page-7487cde68908fec4.js:1:618)
      at 884 (page-7487cde68908fec4.js:1:683)
  ```
- 비로그인/로그인 모두 동일
- 시크릿 창에서도 동일
- 다른 페이지(`/`, `/studio` 등)는 정상

---

## 발견 경위

paddle wire-up 배포(commit `c514695`, 2026-05-06) 직후 LEE가 production `/pricing` 검증 중 발견. 첫 반응은 "Vercel 환경변수 누락이겠지" — 가장 일반적인 가설.

---

## 가설 변천사

진단에 약 1시간 소요. 7개 가설을 거쳤다.

### 1차: Vercel 환경변수 미등록 (부분 무효)
- 가설: Vercel UI에 변수 자체가 없거나 빈 값
- 검증: LEE Vercel UI 확인 → 변수 등록됨, value 채워짐
- 폐기 근거: 등록은 됐는데 client bundle에 안 박힘

### 2차: Vercel 환경 분리 — Production 미체크 (무효)
- 가설: Preview/Development에만 추가되고 Production 환경 체크 누락
- 검증: LEE Vercel UI 직접 확인 → Production 환경에 ✅
- 폐기 근거: 정상 등록 확인

### 3차: Vercel build cache 재사용 (무효)
- 가설: env 변경 후 build cache로 옛 bundle 재사용 (NEXT_PUBLIC_*는 빌드 시점 inline)
- 검증: "Use existing Build Cache" 해제 redeploy → 같은 에러
- 폐기 근거: 캐시 해제했어도 동일 결과

### 4차: Vercel 도메인 routing / CDN stale (무효)
- 가설: Vercel build는 정상이지만 production 도메인이 옛 build 가리킴, 또는 CDN이 옛 HTML 캐시
- 결정적 검증: **Vercel deployment URL(`novelagent-xxxxx.vercel.app`)에 직접 접속 → 같은 에러**
- 폐기 근거: production 도메인이 아니라 Vercel 측에서 직접 build 결과를 봐도 같은 에러 → CDN/도메인 무관

### 5차: 브라우저 캐시 / Service Worker (무효)
- 가설: 브라우저가 옛 HTML/chunk를 stale 캐시
- 검증: 시크릿 창 + `navigator.serviceWorker.getRegistrations()` → SW: 0
- 폐기 근거: 브라우저 측 캐시 모두 무관

### 6차: 로그인 가드 / 인증 토큰 문제 (사용자 가설, 무효)
- 가설: `/pricing`이 로그인 사용자만 접근 가능하게 가드돼 있고 토큰 처리에서 실패
- 검증: middleware.ts 부재, root layout에 redirect 없음, /pricing은 (main)/(admin) 그룹 외부 → 가드 자체가 없음
- 자기 반박: 가드 있었다면 비로그인은 /login으로 redirect 됐을 것. 비로그인에서 환경변수 에러가 뜬다는 사실 자체가 가드 부재의 증거
- 폐기 근거: 코드 차원에서 가드 없음 확인

### 7차: Vercel build env 자체 등록 누락 (재시도, 무효)
- 가설: Vercel UI에 보이는 것과 실제 build env가 다를 가능성 (보이지 않는 공백, zero-width char 등)
- 검증: LEE 직접 value 다시 입력 + 저장 + cache 해제 redeploy → 같은 에러
- 폐기 근거: 등록은 정확. build에서 env를 못 받는 게 아니라 **client bundle inline 자체가 안 됨**

### 8차: 코드 측 dynamic env access (확정 RC)
- 가설: webpack DefinePlugin이 NEXT_PUBLIC_* 를 빌드 시점에 inline하는데 호출 패턴에 따라 inline 여부 갈림
- 검증: `config.ts:requiredEnv` 함수 내부의 `process.env[name]` (dynamic key access) 발견
- 확정: NEXT_PUBLIC_* 변수가 정상 등록돼 있어도 dynamic key access는 inline 안 됨 → client bundle에서 `undefined` → throw

---

## 결정적 단서

**Vercel deployment URL 직접 접속에서도 같은 에러가 떴다는 사실.**

이 단서로 인해 (1) production 도메인 routing, (2) CDN, (3) 브라우저 캐시, (4) Service Worker 가능성이 모두 한 번에 제거됐다. 본질은 build 결과물 자체에 있다는 게 확정되며 진단 방향이 코드로 좁혀졌다.

추가 단서: 같은 `config.ts` 안에서 `readPaddleEnvironment()` 함수의 `process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT` (literal access)는 **정상 inline 됨**. 같은 파일 안에서 한 변수는 OK, 다른 변수는 NG라는 비대칭이 진단을 늦춘 함정이었다.

---

## Root Cause

**webpack DefinePlugin (Next.js의 NEXT_PUBLIC_* inline 메커니즘)은 literal access만 처리한다.**

| 패턴 | 빌드 시점 처리 | client bundle 결과 |
|---|---|---|
| `process.env.NEXT_PUBLIC_X` | string literal로 치환 | 값 inline됨 ✅ |
| `process.env["NEXT_PUBLIC_X"]` | string literal로 치환 (대부분 번들러) | 값 inline됨 ✅ |
| `process.env[name]` (dynamic key) | 치환 불가 | runtime lookup → client에서 `undefined` ❌ |

기존 `config.ts:requiredEnv`:
```typescript
function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();  // ← dynamic key access
  if (!v) throw new Error(`[paddle] 환경변수 누락: ${name}`);
  return v;
}

export const PADDLE_PRICES = {
  STANDARD_MONTHLY: requiredEnv("NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY"),
} as const;
```

호출 시 `requiredEnv` 함수 내부의 `process.env[name]`는 빌드 시점에 어떤 변수인지 정적으로 알 수 없으므로 webpack이 inline 못 함. server 환경에선 runtime `process.env`가 정상이라 작동했지만, client bundle에서 `process.env`는 NEXT_PUBLIC_* 변수 일부만 literal로 치환된 형태라 dynamic key는 모두 `undefined`.

---

## 처방

`config.ts` 수정 (commit `2cca009`):

1. **`requiredPublicEnv(name, value)` 헬퍼 신설**:
   - `name`: 에러 메시지용 식별자
   - `value`: 호출부에서 **literal access**한 실제 값
   - 빌드 시점에 호출부의 literal access가 inline됨 → 헬퍼 함수 호출은 그대로지만 인자가 string literal이므로 정상 동작

2. **호출부 변경**:
   ```typescript
   export const PADDLE_PRICES = {
     STANDARD_MONTHLY: requiredPublicEnv(
       "NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY",
       process.env.NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY  // ← literal access!
     ),
   } as const;

   export const PADDLE_CLIENT_CONFIG = {
     environment: readPaddleEnvironment(),
     clientToken: requiredPublicEnv(
       "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
       process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
     ),
   } as const;
   ```

3. **server 전용 변수는 기존 `requiredEnv` 유지**:
   - `PADDLE_API_KEY_*`, `PADDLE_WEBHOOK_SECRET_*` 등은 server 환경에서만 호출되므로 dynamic access도 정상 작동

---

## 검증

- 빌드 통과 (commit `2cca009`)
- production `/pricing` 시크릿 창 접속 → 정상 로드, "구독하기" 버튼 표시
- inline 검증:
  ```js
  fetch('/pricing').then(r=>r.text()).then(t=>{const m=t.match(/page-[a-f0-9]+\.js/g);return fetch('/_next/static/chunks/'+m[0])}).then(r=>r.text()).then(t=>console.log('inlined:', t.includes('pri_01kq')))
  ```
  → `inlined: true` (price ID가 client bundle에 들어감)

---

## 교훈

### 1. "Vercel env 문제"로 보이는 게 실제론 코드 문제
표면 증상이 명확한 "환경변수 누락 에러"라 모두가 Vercel 측을 의심했다. LEE가 Vercel UI를 4~5번 확인하고 cache를 두 번 해제하고 redeploy를 여러 번 했지만 본질은 코드에 있었다. **에러 메시지의 표면 텍스트보다 에러 발생 메커니즘을 한 번 더 의심하자.**

### 2. 같은 파일 안에서 inline 동작이 비대칭
`readPaddleEnvironment()` 의 literal access는 잘 됐는데 `requiredEnv("X")` 의 dynamic은 안 됐다. **같은 파일이라고 다 같은 동작 아니다.** "한 변수는 되는데 다른 변수는 안 된다"는 미묘한 비대칭이 진단을 늦췄다.

### 3. Vercel deployment URL 직접 접속이 진단 분기점
production 도메인 + CDN + 브라우저 캐시 등 layer가 많을 때, **Vercel 측 build 결과를 직접 보는 것**이 빠르게 분기를 좁힌다. "production 도메인에서 같은 에러" + "deployment URL에서도 같은 에러" = 도메인/CDN 무관 확정.

### 4. 사용자 가설을 코드로 반박
LEE가 "로그인 가드 때문 아닐까" 가설을 가져왔을 때 코드를 직접 확인해 (middleware 부재 + root layout redirect 없음) 가설을 기각했다. 가설 자체에 끌려가면 시간 낭비, 코드가 진실 원천.

### 5. fail-fast의 양면성
`config.ts`가 모듈 로드 시점에 throw하는 fail-fast 설계는 빌드 단계에선 강점(잘못된 env 즉시 빌드 fail)이지만, 런타임에선 페이지 전체 다운으로 직결된다. **production 결제 페이지처럼 critical한 곳은 lazy 평가 + graceful fallback이 안전.** 향후 결제 외 영역도 같은 패턴 점검 필요.

### 6. webpack/Next.js 빌드 메커니즘 한 줄 이해
`NEXT_PUBLIC_*` inline은 **literal access만**. 한 번 알면 평생 안 까먹는 함정인데, 처음 마주치면 1시간 진단 시간이 사라진다.

---

## 후속 작업

### 즉시 (D+0)
- [x] 처방 코드 수정 + 배포 (commit `2cca009`)
- [x] inline 검증 (시크릿 창 + chunk fetch)

### 단기 (D+1 ~ D+7)
- [x] 백로그 P2-007 등록 — 코드베이스 잔존 dynamic access 점검
- [x] TS-002 트러블슈팅 문서 작성 (이 문서)
- [ ] `grep -rn "process.env\[" src/` 로 잔존 패턴 전수 점검

### 정책
- 신규 NEXT_PUBLIC_* 변수 추가 시 **`requiredPublicEnv(name, value)` 헬퍼 사용 강제**
- PR 템플릿에 "NEXT_PUBLIC_* 추가 여부" 체크박스 추가 검토
- ESLint custom rule 또는 CodeQL 같은 정적 분석으로 `process.env[<dynamic>]` 패턴 경고 검토 (P3 수준)

---

## 진단에 사용한 명령

### 1. production HTML이 참조하는 chunk 확인
```js
fetch('/pricing').then(r=>r.text()).then(t=>{
  const m=t.match(/page-[a-f0-9]+\.js/g);
  console.log('현재 chunks:',m);
})
```

### 2. chunk 안에 변수 inline 됐는지 확인
```js
fetch('/_next/static/chunks/<chunk 이름>')
  .then(r=>r.text())
  .then(t=>console.log('inlined:', t.includes('pri_01kq')))
```

### 3. Service Worker 영향 확인
```js
navigator.serviceWorker.getRegistrations().then(r=>console.log('SW:',r.length))
```

### 4. 코드베이스 dynamic access 잔존 검색 (후속 작업용)
```bash
grep -rn "process\.env\[" src/ --include="*.ts" --include="*.tsx"
```

---

## Related

- 사고 유발 commit: `c514695` (paddle wire-up, dynamic access 코드 추가)
- 무효 처방 시도: `f104581` (env 변경 + redeploy, 효과 없음)
- 본질 처방 commit: `2cca009` (literal access로 변경)
- 백로그: P2-007 (잔존 패턴 전수 점검)
- 관련 ADR: ADR-0010 (Paddle Sandbox Billing)
