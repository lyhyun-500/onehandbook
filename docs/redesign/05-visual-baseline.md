# Visual Baseline 정책 — 활성

> 작업 3 페이즈 4 시점 (2026-05-09): "보류" 결정 박힘 — 디자인 토큰 미확정.
> 디자인 페이즈 1 Commit 5 시점 (2026-05-10): **박힘 — 활성**. 결정 사항 ADR-0025 참조.

## 활성화 사유

- 페이즈 1 박은 디자인 토큰 (ADR-0022) + atoms (ADR-0024) 박힌 상태.
- 페이즈 2~5 박은 디자인 마이그레이션 박은 박은 박은 박은 baseline 박지 않으면 회귀 박은 박지 못함.
- 페이즈 1 종점 박은 박은 박은 (snapshot/phase-1-end/) 박은 박은 박은 박은 — 페이즈 2 박은 박은 박은 박은 박은.

---

## 1. baseline 두 종류 (ADR-0025 결정 1)

| 종류 | 의도 | 위치 | fail 박은 박은 |
|---|---|---|---|
| **guard** | 디자인 시스템 (atoms) 회귀 검출 | `e2e/baseline/guard/` | 회귀 → PR 차단 |
| **snapshot** | 페이즈별 의도된 디자인 박제 | `e2e/baseline/snapshot/<페이즈>/` | 의도된 변경 → LEE 승인 후 갱신 |

### 페이즈 1 Commit 5 박힌 baseline (3건)

```
e2e/baseline/
├── guard/
│   └── atoms-preview.spec.ts          # /dev/atoms-preview (Modal 닫힘)
└── snapshot/
    └── phase-1-end/
        ├── landing.spec.ts             # 비로그인 /
        └── login.spec.ts               # 비로그인 /login (단독 페이지)
```

---

## 2. Docker 환경 통제 (ADR-0025 결정 3)

baseline 박는 환경 = `mcr.microsoft.com/playwright:v1.59.1-noble` (Linux). 호스트 macOS 박지 않음.

```bash
cd onehandbook
docker run --rm --ipc=host \
  -v "$(pwd):/work" \
  -v /work/node_modules \
  -v /work/.next \
  -w /work \
  mcr.microsoft.com/playwright:v1.59.1-noble \
  bash -c "npm ci && CI=true npm run test:e2e:baseline -- --update-snapshots"
```

- anonymous volume (`-v /work/node_modules`, `-v /work/.next`) 박은 호스트 darwin-arm64 ↔ 컨테이너 linux-arm64 native binary 충돌 회피.
- M1 arm64 호환 검증됨.

---

## 3. false positive 처리 (ADR-0025 결정 5)

### dev mode 부산물 — mask

| 위젯 | selector | 처리 |
|---|---|---|
| Next.js dev indicator | `[data-next-mark]`, `[data-nextjs-toast]` | mask (production 박지 않음) |

박은 spec mask 패턴 (3 spec 동일):

```ts
await expect(page).toHaveScreenshot('<name>.png', {
  mask: [
    page.locator('[data-next-mark]'),
    page.locator('[data-nextjs-toast]'),
  ],
});
```

### 자체 컴포넌트 — baseline (mask 안 박음)

| 위젯 | 박은 사유 |
|---|---|
| FloatingInquiryButton (FAB) | Novel Agent 자체 컴포넌트 → production 박은 박은 박은 → 디자인 시스템 토큰 영향 박는 항목 |

### 동적 콘텐츠 안정화

| 항목 | 정책 |
|---|---|
| GenreScoreCounter (1.5s 카운팅) | `page.emulateMedia({ reducedMotion: 'reduce' })` 박은 박은 즉시 target 박힘 |
| LandingHeroCoverSliders (cover 마퀴) | `animations: 'disabled'` (config 기본값) 박은 박은 infinite animation cancel → 시작 frame 박힘 |
| cover 이미지 lazy-load | `page.goto('/', { waitUntil: 'networkidle' })` 박은 박은 박힘 시점 통일 |

### mask selector 사전 검증 함정

`nextjs-portal` 박은 web component 박혀 있으나 bbox **0×0** 박혀 mask 박지 못함. 박은 박은 박은 박은:

```ts
const box = await page.locator(sel).first().boundingBox();
console.log(`${sel} → ${JSON.stringify(box)}`);
```

박은 박은 박은 박은 visible element 박은 박은 박음. ADR-0025 함정 2 박음.

---

## 4. npm scripts (5건)

| script | 용도 |
|---|---|
| `test:e2e:baseline` | guard + snapshot 둘 다 |
| `test:e2e:baseline:guard` | guard 만 |
| `test:e2e:baseline:snapshot` | snapshot 만 |
| `test:e2e:update-baseline` | 박은 박은 박은 baseline 박은 박은 (`--update-snapshots`) |
| `test:e2e:update-baseline:snapshot` | snapshot 박은 박은 박은 |

`update-baseline:guard` 박지 않음 — guard 갱신은 매우 신중한 결정 박은 항목. 박은 박은 박은 `--update-snapshots` 박은 박은 박은.

---

## 5. 갱신 정책 (ADR-0025 결정 6) — LEE 게이트

baseline png 박은 갱신 박은 박은 박은 박은 박은. **LEE 명시 승인 박은 박은 Claude Code 박은 박음**. PR 박은 박은 박은 박은 박은:

- guard: `guard baseline 갱신: <사유>` (atoms 어떤 변경 의도 박은 항목)
- snapshot: `snapshot baseline 갱신 (phase-X-end → phase-Y-end): <사유>` (페이즈 디자인 박은 항목)

박은 LEE 게이트 박지 않은 갱신은 정책 위반 (회귀 가드 무용).

---

## 6. 페이즈 2~5 마이그레이션 시 baseline 갱신 흐름

### 페이즈 2 (사이드 패널)

- guard: atoms 박은 박은 박은 박은 박은 박은 박은 박은. (atoms 박지 않은 박은 박은 박은 박은.)
- snapshot/phase-1-end/landing.png — 박은 박은 박은 박은 박은 박은 → 페이즈 2 박은 박은 박은 박은 박은:
  - 박은 박은 `e2e/baseline/snapshot/phase-2-end/` 박은 박은.
  - 박은 박은 박은 박은 박은 (phase-1-end 박은 박은 박은 박은 박은 박은 박은 박은).
  - 박은 페이즈 2 박은 박은 박은 박은 박은 박은 박은 박은.

### 페이즈 3~5

- 새 페이지 박은 박은 → `e2e/baseline/snapshot/phase-X-end/<페이지>.spec.ts` 박음.
- 박은 mask 정책 재사용 (`[data-next-mark]` + `[data-nextjs-toast]`).
- 박은 박은 박은 박은 박은 selector 박은 동작 사전 검증 + 폴백 박은 박은.

---

## 7. 페이즈 1 Commit 5 종료 시점 상태 (2026-05-10)

| 항목 | 상태 |
|---|---|
| `playwright.config.ts` (toHaveScreenshot 옵션 박음) | ✅ |
| `e2e/baseline/guard/atoms-preview.spec.ts` + png | ✅ |
| `e2e/baseline/snapshot/phase-1-end/landing.spec.ts` + png | ✅ |
| `e2e/baseline/snapshot/phase-1-end/login.spec.ts` + png | ✅ |
| npm scripts (5건) | ✅ |
| ADR-0025 박음 | ✅ |
| guard 통과 (1 passed, 38.3s) | ✅ |
| snapshot 통과 (2 passed, 51.8s) | ✅ |
| regression 통과 (18 passed / 2 flaky retry / 1 skipped, 4.4m) | ✅ |

---

## 관련 commit / 문서

- ADR-0025 (visual baseline 정책)
- 페이즈 1 Commit 5 (이 문서 갱신 + spec 3개 + ADR + script + config)
- ADR-0019 (E2E spec layered pattern)
- ADR-0020 (E2E selector 전략)
- ADR-0024 (컴포넌트 아키텍처 — guard 검증 대상)
