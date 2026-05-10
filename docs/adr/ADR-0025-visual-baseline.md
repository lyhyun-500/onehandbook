# ADR-0025: Visual Baseline 정책 — guard / snapshot 분리, Docker 환경, mask 정책

- **Status**: Accepted
- **Date**: 2026-05-10
- **Related**:
  - ADR-0019 (E2E spec layered pattern) — regression / baseline 분리 원안.
  - ADR-0020 (E2E selector 전략) — role/aria/URL 우선, testid 점진 도입.
  - ADR-0024 (컴포넌트 아키텍처) — atoms-preview 페이지가 guard baseline 검증 대상.
  - 페이즈 1 Commit 5 (이 ADR 의 적용 사례 — guard 1 + snapshot 2 첫 박힘).
  - 페이즈 2~5 디자인 마이그레이션 — snapshot 갱신 트리거.

---

## Context

### 발견 경위

페이즈 1 Commit 5 (visual baseline) 진입 시점:

- 안전망 페이즈 (ADR-0019) 박을 때 `e2e/baseline/` 디렉터리 + `test:e2e:baseline` / `test:e2e:update-baseline` npm script 미리 박았으나 **빈 껍데기**. 디자인 토큰 미확정 상태로 baseline 박으면 즉시 무용 → 페이즈 1 Commit 5 로 박는 박을 미룸 (`docs/redesign/05-visual-baseline-deferred.md`).
- 페이즈 1 (색상/타이포 토큰 + atoms — Button / Input / Card / Badge / Modal) 박힌 후 baseline 진입.

### 문제 정의

1. **두 종류의 시각 변경 의도 분리**: 디자인 시스템 (atoms) 의 변경은 회귀로 검출해야 함 (의도치 않은 변경). 페이지 (랜딩/로그인/스튜디오) 의 변경은 페이즈마다 의도된 변경 — 검출하되 박힌 갱신 흐름 별도. 동일한 baseline 으로 두 의도를 박으면 변경 시 어떤 게 회귀고 어떤 게 의도된 변경인지 진단 불가.
2. **환경 통제**: 폰트 렌더링 / anti-aliasing / browser 버전이 박힌 OS 마다 다름. 호스트 macOS 와 CI Linux 박힌 환경이 박힐 때 baseline 매번 fail. 통제된 박힌 환경 박는 게 기준.
3. **dynamic content false positive**: 페이지에 박힌 cover 마퀴 / 카운터 애니메이션 / dev mode 부산물 (Next.js dev indicator) 박혀 있음. 박은 영역 처리 정책 박혀야 함.
4. **mask selector 안정성**: mask 박을 element 의 selector 가 박힌 박은 동작 박지 않으면 baseline 안정성 0. 사전 검증 정책 박아야 함.

---

## Decision

### 결정 1 — baseline 두 종류 분리: guard / snapshot

| 종류 | 의도 | 위치 | 변경 시 |
|---|---|---|---|
| **guard** | 디자인 시스템 (atoms) 회귀 검출 | `e2e/baseline/guard/<페이지>.spec.ts` | fail = 회귀 → PR 차단 / 의도 명시 + LEE 승인 후 갱신 |
| **snapshot** | 페이즈별 의도된 디자인 박제 | `e2e/baseline/snapshot/<페이즈>/<페이지>.spec.ts` | fail = 의도된 변경 검출 → LEE 승인 후 baseline 갱신 |

- guard 의 검증 대상: `/dev/atoms-preview` (Button / Input / Card / Badge / Modal-trigger) — atoms 어느 하나 변경 시 visual diff 박힘.
- snapshot 의 검증 대상: 사용자 보는 페이지 (랜딩, 로그인 등). 페이즈별 박힌 디렉터리 (`phase-1-end/`, `phase-2-end/` 등) 으로 박힌 박제 명확.

### 결정 2 — 페이즈 1 Commit 5 박힌 baseline (3건)

| 파일 | 종류 | 검증 대상 |
|---|---|---|
| `e2e/baseline/guard/atoms-preview.spec.ts` | guard | atoms 표준 상태 (Modal 닫힘) |
| `e2e/baseline/snapshot/phase-1-end/landing.spec.ts` | snapshot | 비로그인 랜딩 |
| `e2e/baseline/snapshot/phase-1-end/login.spec.ts` | snapshot | 비로그인 /login 단독 페이지 |

`/login` 은 현 시점 단독 페이지 박힘 (모달 아님) — 페이즈 2 에서 모달 전환 시 spec 명/내용 갱신.

### 결정 3 — 환경 통제: Docker (Playwright 공식 컨테이너)

- baseline 박는 환경: `mcr.microsoft.com/playwright:v1.59.1-noble` (M1 arm64 호환 검증).
- 호스트 macOS 박힌 baseline 박지 않음 — 폰트 / anti-aliasing 차이로 CI 와 baseline 매번 박지 못함.
- volume mount 패턴 — node_modules / .next 는 anonymous volume 박아 호스트 darwin-arm64 ↔ 컨테이너 linux-arm64 native binary 충돌 회피:

```bash
docker run --rm --ipc=host \
  -v "$(pwd):/work" \
  -v /work/node_modules \
  -v /work/.next \
  -w /work \
  mcr.microsoft.com/playwright:v1.59.1-noble \
  bash -c "npm ci && CI=true npm run test:e2e:baseline -- --update-snapshots"
```

### 결정 4 — Playwright config 옵션

`playwright.config.ts` 의 `expect.toHaveScreenshot` 기본값:

```ts
toHaveScreenshot: {
  maxDiffPixelRatio: 0.02,   // 2% diff 허용 (Playwright 표준)
  animations: 'disabled',    // CSS animation cancel
  caret: 'hide',             // Input caret blink 박지 않음
}
```

- `animations: 'disabled'` 박힌 결과: infinite animation (cover 마퀴 등) cancel → 시작 frame 박힘. finite animation 박힌 박은 마지막 frame 박음.
- `caret: 'hide'` — 박힌 input/textarea 박은 caret blink 박지 않음.
- `maxDiffPixelRatio: 0.02` — 2% diff 허용. 폰트 렌더링 미세 차이 박은 박은 박은 박은 박지 않게 박은 표준값.

### 결정 5 — mask 정책 (옵션 B): dev indicator mask + 자체 컴포넌트(FAB) baseline

| 위젯 | 종류 | 정책 | 사유 |
|---|---|---|---|
| Next.js dev indicator | dev mode 부산물 (production X) | **mask** | production 사용자에게 안 박힘 → baseline 검증 가치 0 |
| FloatingInquiryButton (FAB) | Novel Agent 자체 컴포넌트 | **baseline** | production 사용자가 보는 실제 UI → 디자인 시스템 토큰 영향 박는 항목 |

- 옵션 A (둘 다 mask) 기각: FAB mask 박으면 디자인 시스템 회귀 가드 구멍 박힘.
- 옵션 C (둘 다 baseline) 기각: dev indicator baseline 박으면 production 시각 검증 의미 0 + Next.js 버전 업 시 false positive.

mask selector (3 spec 모두 동일 박힘):

```ts
mask: [
  page.locator('[data-next-mark]'),
  page.locator('[data-nextjs-toast]'),
]
```

랜딩 / 로그인 / atoms-preview 모두 두 위젯 박혀 있음. dev indicator 박은 영역만 핑크 사각형 박음, FAB 박은 영역 baseline 박음.

### 결정 6 — 갱신 정책: LEE 게이트

- baseline png 박은 갱신 = `--update-snapshots` 박은 명시적 명령 박은 박은. **LEE 명시 승인 후 Claude Code 박은 박음**.
- PR 박을 때 baseline 갱신 박혀 있으면 commit 메시지 또는 PR 본문에 박은 사유 박음:
  - guard: "guard baseline 갱신: <사유>" — atoms 어떤 변경 의도 박힌 항목.
  - snapshot: "snapshot baseline 갱신 (phase-X-end → phase-Y-end): <사유>" — 페이즈 디자인 박힌 항목.
- 박은 LEE 게이트 박지 않은 박은 갱신은 정책 위반 (회귀 가드 무용).

### 결정 7 — npm scripts (5건)

```json
{
  "test:e2e:baseline":             "playwright test e2e/baseline",
  "test:e2e:baseline:guard":       "playwright test e2e/baseline/guard",
  "test:e2e:baseline:snapshot":    "playwright test e2e/baseline/snapshot",
  "test:e2e:update-baseline":      "playwright test --update-snapshots",
  "test:e2e:update-baseline:snapshot": "playwright test e2e/baseline/snapshot --update-snapshots"
}
```

- `test:e2e:update-baseline:guard` 는 박지 않음 — guard 갱신은 매우 신중한 결정 박은 항목 (회귀 가드 자체 갱신). 박은 박은 박은 박을 때 `--update-snapshots` 박은 박은 박은 박은 박은.

---

## 박은 함정 박제 — 페이즈 2~5 박을 때 재발 방지

### 함정 1 — Docker Desktop 권한 다이얼로그 (M1)

- Docker Desktop 4.72.0 박은 macOS 권한 다이얼로그 박지 않은 박은 박은 박은. brew 재설치 박은 패턴 박은 박은 박은:
  ```bash
  brew uninstall --cask docker-desktop
  brew install --cask docker-desktop
  open -a Docker
  ```
- M1 arm64 박은 박은 박은 — `mcr.microsoft.com/playwright:v1.59.1-noble` 박은 multi-arch 박힌 이미지 박은 박은 박은. 호환 박은 박은 박은.

### 함정 2 — Next.js 16 dev indicator mask selector

- `nextjs-portal` 박은 web component 박혀 있으나 박은 자체 박은 bbox **0×0** 박음 (shadow DOM 박은 안 박힌 element 박은 박은 박음). Playwright `mask:` 박은 박은 박은 박은 0×0 박은 element 박은 박은 박지 못함.
- 박은 정공법 selector — `[data-next-mark]` (bbox 22×666×32×32) + `[data-nextjs-toast]` (bbox 20×664×36×36) 박은 visible element 박은 박음.
- **교훈**: 박은 mask selector 박을 때 `boundingBox()` 박은 동작 사전 검증 필수. 박은 selector 박은 박은 박지 않으면 박은 baseline 박은 mask 박지 못한 채 박힌 박은 박은 — fail 박은 박지 않고 박은 false negative 박은 박음.
- 박은 디버그 박은 박은 박은 박은:
  ```ts
  for (const sel of [...]) {
    const box = await page.locator(sel).first().boundingBox();
    console.log(`${sel} → ${JSON.stringify(box)}`);
  }
  ```

### 함정 3 — Update-snapshots 박은 인자 형태

```bash
# 박지 않음 (Playwright argument parser 박은 박은)
playwright test --update-snapshots e2e/baseline

# 박힘 (path 박은 후 옵션)
playwright test e2e/baseline --update-snapshots
```

npm script 박은 `--` separator 박은 형태:
```bash
npm run test:e2e:baseline -- --update-snapshots
```

### 함정 4 — node_modules native binary 충돌

- 호스트 darwin-arm64 ↔ 컨테이너 linux-arm64 박은 박은 native binary (esbuild / swc 등) 박은 박은. 단순 `-v $(pwd):/work` 박은 박은 박은 호스트 node_modules 박은 박은 컨테이너 박음 → 박지 못함.
- 정공법 — anonymous volume 박은 박은 박은 박은:
  ```
  -v /work/node_modules
  -v /work/.next
  ```
  박은 박은 박은 컨테이너 박은 박은 박은 별도 박은 volume 박음 (호스트 영향 0).

---

## Consequences

### 박은 박은

- guard / snapshot 박은 박은 박은 분리 박은 변경 의도 박은 박은 박은 명확.
- 페이즈 2~5 박은 박은 박은 mask 정책 박은 박은 재사용 박은 박은 박은 — `[data-next-mark]` + `[data-nextjs-toast]` 박은 박은 박은 박은 박은.
- LEE 게이트 박은 baseline 박은 박은 박은 박은 박은 박은 — 박은 박은 박은 박은 박은 박은 박은 박은 박은.

### 박은 비용

- baseline 박은 박은 박은 Docker 박은 박은 박은 박은 — 박은 박은 박은 박은 박은 박은 (~3분 / 박은 박은). 박은 박은 박은 박은 박은 박은 박은 박은.
- guard baseline 박은 박은 박은 박은 박은 박은 — atoms 어떤 변경 박은 박은 박은 박은 박은 박은. 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은.

### 박은 페이즈 2~5 박은 박은

- 페이즈 2 박은 박은 박은 사이드 패널 박은 박은 — guard atoms 변경 박은 박은 (atoms 박은 박은 박은 박은). snapshot landing/login 박은 박은 박은 박은 박은 박은 박은.
- 페이즈 3~5 박은 박은 박은 — 새 페이지 박은 박은 박은 `e2e/baseline/snapshot/phase-X-end/<페이지>.spec.ts` 박은 박은 박은. mask 정책 박은 박은 박은 박은 박은 박은.
- 새 동적 영역 박은 박은 박은 박은 selector 박은 박은 박은 사전 검증 + 폴백 selector 박은 박은 박은 박은 박은.

---

## 부록 — guard vs snapshot 정의 분리 사례

박은 결정 1 박은 분리 박은 박은 박은 LEE 인사이트 박은 박은. 박은 박은:

- 박은 1차 박은 박은 박은 박은 박은 — 박은 baseline 박은 박은 박은 박은 박은 (랜딩 / 로그인 / atoms-preview) 박은 박은 박은 박은 박은 박은.
- 박은 LEE 박은 박은 — "박은 atoms 변경 = 회귀 / 박은 페이지 변경 = 의도된 변경" 박은 박은 분리.
- 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은.

박은 박은 — 박은 ADR 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은 박은.
