# 페이즈 1 종점 보고서 (Phase 1 Completion Report)

> 디자인 페이즈 1 (안전망 → 토큰 → atoms → visual baseline) 마무리 박은 보고서.
> 페이즈 2 진입 시 본 문서를 핸드오프 1차 자료로 활용.

---

## 1. 페이즈 1 개요

### 시점

- **시작**: 2026-05-09 (Commit 1 — `393a105` render-blocking 절감)
- **종료**: 2026-05-10 (Commit 6 — 본 보고서)
- **소요**: 2 일

### 작업 범위 (4 영역)

| 영역 | 박힌 commit | 의도 |
|---|---|---|
| Render-blocking 절감 | Commit 1 | 페이즈 1 LCP headroom 확보 (Newsreader 도입 사전 단계) |
| 디자인 토큰 시스템 | Commit 2 | 색상 + 타이포 토큰 박음 (페이즈 2~5 디자인 작업 기준점) |
| atoms 5종 박음 | Commit 3, 3.5, 4, 4.5 | 빌딩 블록 (Button / Input / Card / Badge / Modal) |
| Visual baseline | Commit 5 | guard / snapshot 분리 박음 (시각 회귀 안전망) |

### Commit 카운트: 8

| # | 해시 | 종류 | 한 줄 |
|---|---|---|---|
| 1 | `393a105` | perf | Noto_Sans_KR 제거 (subsets:["latin"] 모순 박힘 발견) — 308KB CSS 절감 |
| 2 | `d7dc53c` | feat(design) | 색상/타이포 토큰 정의 (`@theme` + CSS variables 하이브리드) |
| 3 | `3188baf` | feat(design) | atoms (Button / Input / Card) + 0 dep 아키텍처 |
| 3.5 | `4e84659` | fix(design) | input autofill override + ghost button border 보정 |
| 4 | `6c0b898` | feat(design) | atoms (Badge / Modal) + 0 dep Modal 패턴 |
| 4.5 | `6bf042d` | fix(design) | badge size scale + inline-flex + outline border 보정 |
| 5 | `dfe14cb` | feat(design) | visual baseline (guard + snapshot) + Docker + dev indicator mask |
| 6 | (본 commit) | docs(redesign) | 페이즈 1 종점 보고서 |

---

## 2. 산출물 정리

### 2.1 Render-blocking 절감 (Commit 1)

#### 핵심 변경

- `src/app/page.tsx` 의 `Noto_Sans_KR` import + 변수 선언 + className 적용 **제거** (3줄).
- 한국어 글자는 시스템 폰트 fallback 으로 표시 (이전에도 fallback 으로 표시되고 있었음 — 시각 영향 사실상 0).

#### root cause (3중 모순)

1. `subsets: ["latin"]` 모순 — 한국어 폰트인데 latin subset 만 로드 → 다운로드한 폰트가 한국어 사이트에서 사실상 무용.
2. 4 weights × unicode-range 분할 → production CSS 308 KB.
3. render-blocking + preload 직렬 의존성 → LCP 가 css/font 직렬 의존 체인 후 렌더.

#### 절감 (예상)

- Render-blocking 700ms 의 거의 전량 회수.
- 308 KB CSS → 추정 50~80 KB 로 감소.
- 폰트 preload 3 → 2.

> 실제 절감 정량화는 **4번 섹션 Post Lighthouse** 박힐 별도 commit 에서 박음.

### 2.2 디자인 토큰 시스템 (Commit 2)

#### 패턴

- `@theme inline` + CSS variables 하이브리드 박음 (Tailwind v4 표준).
- 원본 변수는 `:root` 에 박음, Tailwind 노출용은 `@theme inline` 블록에서 `--color-accent: var(--accent)` 매핑.
- `:root` = 다크 (현 사이트 default 보존), `:root.light` = 라이트 override (페이즈 4~5 토글 도입 시 활성).

#### 시그니처 액센트: 잉크 블루 = `blue-600` (`#2563eb`)

- 어드민 액센트 (`--color-admin-accent: #2563eb`) 와 일치 — 사이트 통합성.
- HSL (221, 83%, 53%) — 다크 배경 (`#0a0a0a`) 대비 WCAG AA 충족.

#### 4 단 색상 구조

```css
--accent: ...;             /* base — 버튼 / 링크 / focus ring */
--accent-foreground: ...;  /* accent 위 글자 */
--accent-hover: ...;       /* hover state */
--accent-muted: ...;       /* 옅은 배경 / 디스에이블 */
```

- hover 방향 정책 박음: 라이트 = base 보다 어두워지는 방향 (`blue-600` → `blue-800`), 다크 = base 보다 밝아지는 방향 (`blue-500` → `blue-400`).

#### 폰트 토큰 + fallback chain

```css
--font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont,
             "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic",
             "Noto Sans CJK KR", system-ui, sans-serif;

--font-serif: "Newsreader", "Source Serif Pro", Georgia, serif;
/* 토큰 선언만 — 실 import 는 페이즈 2 LCP A/B 측정 후 결정 */

--font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Monaco, monospace;
```

- `Noto_Sans_KR` 제거 (Commit 1) 후 fallback chain 에 한국어 시스템 폰트 명시 박음 — ADR-0023 약속 이행.
- Newsreader 는 토큰 선언만 박음, import 미박음.

### 2.3 atoms 5종 (Commit 3, 3.5, 4, 4.5)

#### 위치 + 정책

- `src/components/ui/<Name>.tsx` (PascalCase, shadcn 표준 위치).
- **0 dep 정책**: cva / Radix Slot / clsx / tailwind-merge 모두 미도입.
  - variant 는 `Record<Variant, string>` 매핑.
  - className merge 는 `src/lib/utils.ts` 의 `cn()` 단순 helper (~3줄).
  - asChild 미지원.
- `forwardRef` + `displayName` 표준.
- 시각 검증: `src/app/dev/atoms-preview/page.tsx` 갱신 의무 (`/dev/*` proxy guard 로 production 자동 차단).

#### atoms 5종

| atom | variant × size | 비고 |
|---|---|---|
| **Button** | 4 × 3 (primary/secondary/ghost/destructive × sm/md/lg) | disabled state 표준 박음 |
| **Input** | 기본 + aria-invalid | autofill override 박음 (3.5 보정) |
| **Card** | 컨테이너 + Header/Content/Footer | 서브컴포넌트 named export |
| **Badge** | 4 × 2 (variant × size) | inline-flex 박음 (4.5 보정), 작은 캡슐 size scale (h-5 / h-6) |
| **Modal** | 0 dep, createPortal | ESC / backdrop / scroll lock / 포커스 복원 / aria 직접 박음. 포커스 트랩은 미박음 (도입 트리거 명시) |

#### atoms-preview 페이지

- `/dev/atoms-preview` — 5 atoms 모두 박힘.
- 시각 검증으로 함정 6건 발견 (3.5 / 4.5 보정 commit 트리거).
- 페이즈 2~5 atoms 추가 시 본 페이지 갱신 의무.

### 2.4 Visual baseline (Commit 5)

#### guard / snapshot 분리

| 종류 | 의도 | 위치 | 변경 시 |
|---|---|---|---|
| **guard** | 디자인 시스템 (atoms) 회귀 검출 | `e2e/baseline/guard/atoms-preview.spec.ts` | fail = 회귀 → PR 차단 / 의도 명시 + LEE 승인 후 갱신 |
| **snapshot** | 페이즈별 의도된 디자인 박제 | `e2e/baseline/snapshot/phase-1-end/{landing,login}.spec.ts` | fail = 의도된 변경 검출 → LEE 승인 후 baseline 갱신 |

#### 환경 통제: Docker

- `mcr.microsoft.com/playwright:v1.59.1-noble` (M1 arm64 호환).
- 호스트 macOS 박힌 baseline 미박음 — 폰트 / anti-aliasing 차이로 CI 와 불일치 위험.
- anonymous volume 패턴 (`-v /work/node_modules`, `-v /work/.next`) — darwin-arm64 ↔ linux-arm64 native binary 충돌 회피.

#### Playwright config

```ts
toHaveScreenshot: {
  maxDiffPixelRatio: 0.02,   // 2% diff 허용
  animations: 'disabled',    // CSS animation cancel
  caret: 'hide',             // Input caret blink 박지 않음
}
```

#### mask 정책 (옵션 B)

| 위젯 | 정책 | 사유 |
|---|---|---|
| Next.js dev indicator | mask | dev mode 부산물 (production X) |
| FloatingInquiryButton (FAB) | baseline | Novel Agent 자체 컴포넌트, production 사용자 가시 |

mask selector: `[data-next-mark]` + `[data-nextjs-toast]` (폴백 selector 박음 — `nextjs-portal` web component 박은 bbox 0×0 박는 함정 회피).

#### npm scripts (5건)

- `test:e2e:baseline` — 전체.
- `test:e2e:baseline:guard` — guard only.
- `test:e2e:baseline:snapshot` — snapshot only.
- `test:e2e:update-baseline` — 갱신 (LEE 게이트).
- `test:e2e:update-baseline:snapshot` — snapshot only 갱신.
- (`test:e2e:update-baseline:guard` 는 박지 않음 — guard 갱신은 매우 신중한 결정, `--update-snapshots` 옵션 박음)

---

## 3. ADR 박힘 (4개)

| ADR | 제목 | Status | 갱신 이력 | Commit |
|---|---|---|---|---|
| **0022** | 디자인 토큰 정의 정책 (페이즈 1 — 색상 + 타이포 4 단 토큰 + 다크/라이트 override) | Accepted v3 | v1 → v2 (LEE 1차 검토 6건) → v3 (잔여 2건 박힘: 다크 default, hover 1건 미세 조정) | 2 |
| **0023** | 랜딩 페이지의 `Noto_Sans_KR` 제거 (페이즈 1 render-blocking 절감) | Accepted v1 | — | 1 |
| **0024** | 컴포넌트 아키텍처 — atoms 위치 / 0 dep / forwardRef / cn() / 시각 검증 | Accepted v1 | 결정 7-bis (Commit 3.5), 결정 8 강화 사례 1차/2차 (Commit 3.5/4.5), 결정 8-bis (Commit 4) | 3, 3.5, 4, 4.5 |
| **0025** | Visual Baseline 정책 — guard / snapshot 분리, Docker 환경, mask 정책 | Accepted v1 | 부록: guard vs snapshot 정의 분리 사례 (LEE 인사이트 박제) | 5 |

### 핵심 결정 요약

#### ADR-0022 (디자인 토큰)

- 액센트 = blue-600 (`#2563eb`) — 어드민 통합.
- 4 단 액센트 구조 (base / foreground / hover / muted).
- `@theme inline` + CSS variables 하이브리드.
- 다크 default + 라이트 override (현 사이트 강제 다크 보존).
- Newsreader 토큰만 박음 (실 적용은 페이즈 2 LCP A/B 후).

#### ADR-0023 (Noto_Sans_KR 제거)

- root cause = `subsets:["latin"]` 모순 (한국어 폰트인데 latin subset).
- 한국어 글자는 이전에도 fallback 표시 → 시각 영향 사실상 0.
- 페이즈 2 한국어 웹폰트 재도입은 LCP A/B 측정 조건부.

#### ADR-0024 (컴포넌트 아키텍처)

- `src/components/ui/` 위치, 0 dep 정책, forwardRef + displayName 표준.
- variant Record 매핑 + `cn()` 단순 helper.
- atoms-preview 갱신 의무 (시각 회귀 1차 안전망).
- dep 도입 트리거 명시 (asChild 3+, variant 매트릭스 복잡, conditional className 5+, tw class 충돌).

#### ADR-0025 (Visual baseline)

- guard / snapshot 분리 (의도 분리 박힘 → 변경 시 진단 명확).
- Docker (`mcr.microsoft.com/playwright:v1.59.1-noble`) 박음.
- maxDiffPixelRatio 0.02.
- mask 정책 (옵션 B): dev indicator mask + FAB baseline.
- LEE 게이트 정책 — baseline 갱신은 명시적 승인 필수.

---

## 4. Pre/Post Lighthouse 비교

### Pre (페이즈 1 시작 직전, 2026-05-09)

> 출처: `docs/redesign/07-baseline-pre-phase1.md`

| 항목 | 값 | 임계값 | 상태 |
|---|---|---|---|
| Performance | **80** | 90+ | 🟡 |
| Accessibility | 100 | 90+ | 🟢 |
| Best Practices | 96 | 90+ | 🟢 |
| SEO | 100 | 90+ | 🟢 |
| **LCP** | **3.9s** | < 2.5s | 🔴 (최대 약점) |
| FCP | 2.9s | < 1.8s | 🔴 |
| TBT | 190ms | < 200ms | 🟢 |
| CLS | 0 | < 0.1 | 🟢 (완벽) |
| Speed Index | 2.9s | < 3.4s | 🟢 |

#### Insights (자동 진단)

| 항목 | 절감 가능 | 우선순위 |
|---|---|---|
| Render-blocking requests | **700ms** | 🔴 최우선 |
| Reduce unused JavaScript | 152 KiB | 🔴 |
| Minimize main-thread work | 2.5s | 🔴 |
| Reduce unused CSS | 24 KiB | 🟡 |

### Post (페이즈 1 종료 + production 배포 후)

> **TBD — 별도 commit 박힐 예정**.
>
> 측정 시점: 페이즈 1 묶음 push (Commit 1~6) → main 머지 → Vercel production 자동 배포 (~2-3분) → 시크릿 창 Lighthouse 측정.
>
> 측정 조건: Pre baseline 과 동일 — Mobile (Emulated Moto G Power), Slow 4G throttling, Initial page load.
>
> 측정 박힐 commit: `docs(redesign): add post-phase-1 lighthouse measurement` — 본 보고서 4번 섹션의 placeholder 채움.

| 항목 | Pre | Post | 변화 | 비고 |
|---|---|---|---|---|
| Performance | 80 | TBD | TBD | Commit 1 의 render-blocking 절감 효과 + 토큰/atoms 도입 영향 |
| LCP | 3.9s | TBD | TBD | Commit 1 의 Noto_Sans_KR 제거가 핵심 — 폰트 직렬 의존 체인 단축 |
| FCP | 2.9s | TBD | TBD | render-blocking CSS 308 KB → 추정 50~80 KB 감소 |
| TBT | 190ms | TBD | TBD | 토큰/atoms 도입은 JS 비용 거의 없음 — 유지 예상 |
| CLS | 0 | TBD | TBD | 폰트 변경 시 layout shift 미세 발생 가능 |
| Speed Index | 2.9s | TBD | TBD | render-blocking 절감 효과 |

### 페이즈 5 종료 후 비교 목표 (참고)

| 항목 | Pre | 페이즈 5 목표 |
|---|---|---|
| Performance | 80 | **90+** |
| LCP | 3.9s | **< 2.5s** |
| FCP | 2.9s | < 1.8s |
| TBT | 190ms | 유지 (< 200ms) |
| CLS | 0 | 유지 |

---

## 5. 페이즈 2 진입 조건

### 5.1 회귀 슈트 통과

- `npm run test:e2e:regression` — 페이즈 1 묶음 commit 박힌 후 통과 확인.

### 5.2 baseline 통과

- `npm run test:e2e:baseline:guard` — atoms 회귀 가드 통과.
- `npm run test:e2e:baseline:snapshot` — phase-1-end 박힌 baseline 통과.

### 5.3 snapshot baseline 갱신 정책 (페이즈 2 랜딩 작업 시점)

- 페이즈 2 = 랜딩 디자인 마이그레이션 — snapshot 의 `landing.spec.ts` 박힌 baseline 깨짐.
- **갱신 흐름**: 페이즈 2 랜딩 작업 PR → snapshot fail = 의도된 변경 → LEE 명시 승인 → `npm run test:e2e:update-baseline:snapshot` → 새 baseline + 갱신 사유 PR 본문 박음 → 머지.
- **새 페이즈 baseline 폴더**: 페이즈 2 종료 시점에 `e2e/baseline/snapshot/phase-2-end/` 박을지 또는 `phase-1-end/` 갱신할지 — 페이즈 2 종료 시점에 결정 (페이즈별 박제가 이력 자산화에 유리, but 폴더 누적 부담).
- guard 는 atoms 변경 안 박혔으면 그대로 통과 — 페이즈 2 랜딩 작업이 atoms 자체를 건드리면 별도 결정.

### 5.4 /login 라우트 처리 (모달 전환 결정 5건)

페이즈 2 진입 시 박을 5건:

1. **/login 라우트 자체 처리**
   - 옵션 1: /login 라우트 제거 + 모든 로그인 진입은 모달.
   - 옵션 2: /login 라우트 유지 (deeplink 호환) + 일반 진입은 모달.
   - 옵션 3: /login 을 단순 redirect 페이지로 박음.

2. **OAuth callback 처리** — Google/Naver Supabase auth flow 박힌 callback URL 검토 (`/api/auth/callback` 등).

3. **모달 닫힘 시 라우트** — 홈 / 직전 페이지 / 모달 진입 직전 위치 보존.

4. **snapshot baseline 갱신** — `e2e/baseline/snapshot/phase-1-end/login.spec.ts` 갱신 또는 로그인 모달 spec 신설 (`e2e/baseline/snapshot/phase-2-end/login-modal.spec.ts`).

5. **deeplink 호환** — 외부 링크 (예: 메일 본문, OAuth 리다이렉트) 가 /login 직접 호출하는 경우 모달 자동 오픈 처리 정책.

### 5.5 Newsreader 폰트 LCP A/B 측정 정책 (페이즈 2 랜딩 작업 시점)

- **측정 시점**: 페이즈 2 랜딩 작업 mid-phase.
- **측정 조건**: Newsreader import 박음 / 미박음 두 빌드 박음 → 시크릿 창 Lighthouse 비교.
- **채택 기준** (LEE 결정, ADR-0022 박힘):
  - LCP +200 ms 이내: 채택 (Newsreader import + 헤드라인/본문 적용).
  - LCP +200 ms 초과: 미채택 또는 헤드라인 한정 (h1/h2 만 적용, 본문은 sans).
- **결정 결과 박힐 위치**: ADR-0022 의 결정 6 갱신 (v4) + 페이즈 2 보고서.

### 5.6 atoms-preview 갱신 의무

- 페이즈 2 랜딩 작업 중 새 atoms 박힐 시 `/dev/atoms-preview` 갱신.
- 새 atoms 박힘 → guard baseline 박음 갱신 (LEE 게이트).

---

## 6. 운영 메모 / 함정 박제 (6건)

페이즈 2~5 박을 때 재발 방지 — 각 함정은 박힌 ADR 또는 commit 메시지에 박혀 있음.

### 함정 1 — Noto_Sans_KR `subsets:["latin"]` 모순 (Commit 1)

- 한국어 폰트인데 latin subset 박혀 308KB 무용지물.
- IDE 자동완성이 "latin" 을 default 로 제시 → 함정 박음.
- 정적 분석 도구 (Lighthouse, eslint-plugin-next) 가 잡지 못함.
- **재발 방지**: 한국어 웹폰트 재도입 시 `subsets` 박음 검증 + production HTML head + CSS 사이즈 직접 측정.

### 함정 2 — Input autofill 토큰 무시 (Commit 3.5)

- 브라우저 user-agent stylesheet 가 `:-webkit-autofill` 박힐 때 토큰 색상 무시 → 연보라 배경.
- **보정**: `globals.css` 에 `input:-webkit-autofill` override 박음 (사이트 전역 input 보호).
- **재발 방지**: 새 input 류 atoms 박힐 때 autofill 시점 시각 검증 의무.

### 함정 3 — Ghost Button 클릭 어포던스 부재 (Commit 3.5)

- `bg-transparent text-foreground hover:bg-accent-muted` 만으로는 hover 전엔 영역 안 보임 → 클릭 어포던스 0.
- **보정**: `border border-border` 추가 (ADR-0024 결정 7-bis).
- **재발 방지**: ghost 류 컴포넌트 박힐 때 hover 전 시각 어포던스 의무 검증.

### 함정 4 — Badge 사이즈 모순 (Commit 4.5)

- Button 사이즈 그대로 박으면 Badge 의 작은 라벨 의미 깨짐.
- **보정**: Badge 만 `h-5 / h-6` 별도 사이즈 (작은 캡슐 라벨 표준).
- **재발 방지**: 새 atoms 의 size scale 박을 때 atoms 의 의도된 사용 (텍스트 옆 라벨 vs CTA vs 영역 분리 등) 별 박음.

### 함정 5 — Docker Desktop 권한 다이얼로그 (Commit 5)

- 첫 설치 시 "Use recommended settings + 비밀번호" 놓치면 CLI 미작동.
- **보정**: `brew uninstall --cask docker-desktop && brew install --cask docker-desktop && open -a Docker` — 다이얼로그 재트리거.
- **재발 방지**: Docker baseline 박는 새 환경 박힐 때 권한 다이얼로그 박음 박힘 확인 우선.

### 함정 6 — Next.js 16 dev indicator mask selector (Commit 5)

- `nextjs-portal` web component 박혀 있으나 박은 자체 박은 bbox **0×0** → Playwright `mask:` 박은 0×0 element 박음 박지 못함.
- **보정**: 폴백 `[data-next-mark]` + `[data-nextjs-toast]` (visible element 박음).
- **재발 방지**: 새 mask selector 박을 때 `boundingBox()` 박은 사전 검증 + 폴백 selector 박음.

---

## 7. LEE 인사이트 박힘 (포폴 시그널)

페이즈 1 박는 동안 LEE 박은 박은 박은 인사이트 — 단순 작업 진행 외에 의사결정 흐름 박힘. 포트폴리오 자산.

### 인사이트 1 — guard vs snapshot 정의 분리 (Commit 5, ADR-0025 부록 박힘)

#### 발견

- 1차 핸드오프는 baseline 의 검증 대상 (랜딩 / 로그인 / atoms-preview) 만 박혀 있었음.
- LEE 의문: **"리디자인하면 baseline 다 깨질 텐데 의미가 뭐야?"**

#### 결정

- "atoms 변경 = 회귀" / "페이지 변경 = 의도된 변경" 의 의도 분리 박음.
- guard (회귀 가드) / snapshot (페이즈별 박제) 두 종류 baseline 박음.
- 변경 시 진단 명확 — guard fail = 회귀, snapshot fail = 의도된 변경 + LEE 게이트.

#### 시그널

- 도구 (Playwright baseline) 의 표면적 사용 박는 게 아니라 **"이 도구가 어떤 변경을 검출해야 하는가"** 의 의도 분해 박음.
- 핸드오프 문서의 부정확함 박음 — 도구 사용 정책의 기본 가정을 의문 박음.
- 결과: ADR-0025 박은 의사결정 박힘 + 페이즈 2~5 baseline 갱신 흐름 박힌 정책 명확.

### 인사이트 2 — 점수 카드 dynamic 처리 결정 (Commit 5)

#### 발견

- 랜딩 박힌 점수 카드 박은 dynamic content (분석 결과 박힌 숫자) 박음 — baseline mask 박는 게 표준 패턴.

#### 결정

- LEE 박음: **"페이즈 2 디자인에서 빠질 거"** — 점수 카드 자체가 페이즈 2 랜딩 디자인 마이그레이션 시 사라질 항목.
- mask 처리 불필요 — snapshot baseline 정상 갱신 흐름으로 박음.

#### 시그널

- 박힌 코드 박은 **"미래 계획 박은 박은 박은"** 박음 — 박은 임시 방편 (mask) 박지 않고 박은 자연 흐름 (snapshot 갱신) 박음.
- over-engineering 회피 — mask 박음 + 페이즈 2 진입 시 박은 mask 제거 박음 = 박은 박은 박은 박은 박은. snapshot 갱신 단일 흐름이 깔끔.

### 인사이트 3 — 시각 검증 게이트 (Commit 3.5, 4.5)

#### 발견

- atoms-preview 시각 확인 박은 함정 6건 박은 박음 — Input autofill / Ghost button affordance / Badge size / Outline border / Card 데모 size / grid 셀 stretch.
- 함정 박은 atoms-preview 박지 않으면 production 박힌 후에 박을 박은.

#### 결정

- atoms-preview 박은 시각 검증 박은 박은 정책 박음 (ADR-0024 결정 8).
- atoms 박을 때마다 LEE 박은 직접 시각 확인 박음 → 발견 시 보정 commit 분리 (3.5, 4.5).

#### 시그널

- vibe coding 환경 박은 박은 LLM 시각 박지 못하는 영역 박은 — 사람의 시각 검증 효용 사례.
- 보정 commit 박은 박은 분리 박음 (feat 박은 박은 박은 fix 박은 박은) — 의도 명확, 회귀 진단 명확.
- 페이즈 2~5 박을 때 "atoms 박음 → 시각 검증 → 보정" 사이클 박은 박음 박음.

---

## 8. 페이즈 1 timeline / 의사결정 흐름

### timeline (commit 단위)

```
2026-05-09 (Day 1)
├─ Commit 1 (393a105): Noto_Sans_KR 제거
│  └─ ADR-0023 박음
├─ Commit 2 (d7dc53c): 색상/타이포 토큰
│  └─ ADR-0022 박음 (v3 — LEE 2 차례 검토)
├─ Commit 3 (3188baf): Button / Input / Card
│  └─ ADR-0024 박음
├─ Commit 3.5 (4e84659): input autofill + ghost border 보정
│  └─ ADR-0024 갱신 (결정 7-bis + 결정 8 강화 사례 1차)
├─ Commit 4 (6c0b898): Badge / Modal
│  └─ ADR-0024 갱신 (결정 8-bis)
└─ Commit 4.5 (6bf042d): badge size + inline-flex + outline border 보정
   └─ ADR-0024 갱신 (결정 8 강화 사례 2차)

2026-05-10 (Day 2)
├─ Commit 5 (dfe14cb): visual baseline (guard + snapshot)
│  └─ ADR-0025 박음 (LEE 인사이트로 guard/snapshot 분리 박힘)
└─ Commit 6 (본 commit): 페이즈 1 종점 보고서
   └─ docs/redesign/08-phase-1-completion.md + ADR README 갱신
```

### 의사결정 흐름 (주요 박힌 결정 + 사유 + ADR 매핑)

| 시점 | 결정 | 사유 | 박힌 위치 |
|---|---|---|---|
| Commit 1 사전 분석 | Noto_Sans_KR 제거 (옵션 D) | root cause 단일 (subsets:["latin"] 모순), 시각 영향 사실상 0, 700ms 거의 전량 회수 | ADR-0023 |
| Commit 2 사전 결정 | 액센트 = blue-600 (`#2563eb`) | 어드민 통합성, WCAG AA 충족, Tailwind 표준 | ADR-0022 결정 1 |
| Commit 2 사전 결정 | 4 단 액센트 구조 | shadcn `muted` 의미 충돌 회피 (3 단 → 4 단) | ADR-0022 결정 2 |
| Commit 2 사전 결정 | `@theme` + CSS variables 하이브리드 | Tailwind v4 표준, 다크모드 토글 시 자동 호환 | ADR-0022 결정 3 |
| Commit 2 사전 결정 | 다크 default + 라이트 override | 현 사이트 강제 다크 보존 (코드 변경 0) | ADR-0022 결정 4 |
| Commit 2 사전 결정 | Newsreader 토큰만 박음 | LCP 위험 (07 baseline 의 시사점), 페이즈 2 LCP A/B 후 결정 | ADR-0022 결정 6 |
| Commit 3 사전 결정 | 0 dep 정책 | 단순, dep 추가 비용 0, 첫 박음에서 효용 충분 | ADR-0024 결정 2 |
| Commit 3 사전 결정 | `src/components/ui/` 위치 | shadcn 표준, 도메인 분리 | ADR-0024 결정 1 |
| Commit 3.5 발견 | Ghost border 박음 | atoms-preview 시각 검증으로 클릭 어포던스 0 발견 | ADR-0024 결정 7-bis |
| Commit 4 사전 결정 | Modal 0 dep 직접 구현 | 0 dep 정책 (결정 2) 일관성, ESC/backdrop/focus 직접 박음 | ADR-0024 결정 8-bis |
| Commit 4 사전 결정 | 포커스 트랩 미박음 | 페이즈 1 범위 외, 도입 트리거 명시 | ADR-0024 결정 8-bis (c) |
| Commit 4.5 발견 | Badge size scale 분리 | atoms-preview 시각 검증으로 라벨 의미 깨짐 발견 | ADR-0024 결정 8 강화 사례 2차 |
| Commit 5 사전 분석 | guard / snapshot 분리 | LEE 의문 ("리디자인하면 baseline 다 깨질 텐데") → 의도 분리 박음 | ADR-0025 결정 1 + 부록 |
| Commit 5 사전 결정 | Docker (`mcr.microsoft.com/playwright:v1.59.1-noble`) | 폰트 / anti-aliasing 호스트 차이 회피 | ADR-0025 결정 3 |
| Commit 5 사전 결정 | mask 옵션 B (dev indicator mask + FAB baseline) | dev indicator = production X (가치 0), FAB = production O (디자인 시스템 영향) | ADR-0025 결정 5 |

### 운영 정책 박힌 패턴

페이즈 1 박는 동안 박힌 정책 — 페이즈 2~5 박을 때도 박음:

1. **5+ 파일 변경 룰**: 사전 보고 + LEE 승인 필수.
2. **시각 검증 정책**: atoms-preview 박은 LEE 직접 시각 확인 후 다음 commit 진입.
3. **ADR 박제**: 결정마다 ADR 신설 또는 갱신 (v2, v3 ...).
4. **검토 → 승인 → 진행**: 사전 리포트 박음 → LEE 승인 → 진행.
5. **commit 분리**: feat (의도된 도입) / fix (시각 검증으로 발견된 보정) 분리 — 회귀 진단 명확.
6. **0 dep 우선**: dep 도입 트리거 명시, 트리거 충족 시 별도 ADR.

---

## 9. 다음 단계 (페이즈 1 push 후)

> 본 보고서 commit 박힌 후 LEE 박을 단계.

1. `git push origin feat/design-phase-1` (페이즈 1 묶음 push).
2. GitHub PR 생성 — Merge commit 방식 (squash 안 함, 8 commit 진화 흐름 보존).
   - PR 본문 초안: Claude Code 가 박은 텍스트 → LEE GitHub 복붙.
3. PR 검토 (LEE) → main 머지.
4. Vercel production 자동 배포 대기 (~2-3분).
5. 시크릿 창 Lighthouse 측정 (Mobile, Slow 4G — Pre baseline 동일 조건).
6. 측정 PDF 저장.
7. 별도 commit `docs(redesign): add post-phase-1 lighthouse measurement` — 본 보고서 4번 섹션의 Post placeholder 채움 + Pre/Post 변화 박음.
8. `v-phase-1-end` 태그 박음 (페이즈 2 진입 분기점).
   ```bash
   git tag -a v-phase-1-end -m "Phase 1 end: 8 commits + ADR 4 + post measurement"
   git push origin v-phase-1-end
   ```

---

## 10. 페이즈 1 종점 — 한 줄 요약

> 안전망 페이즈 박은 도구 (Playwright baseline, /dev/* proxy guard) 박은 위에 박은 디자인 토큰 + atoms 5종 박음. 시각 검증 게이트 박은 함정 6건 박은 박음. guard / snapshot 분리 박은 페이즈 2~5 디자인 마이그레이션 박을 회귀 진단 흐름 박음. ADR 4건 박힘 (0022~0025), commit 8건, 2일 박음.
