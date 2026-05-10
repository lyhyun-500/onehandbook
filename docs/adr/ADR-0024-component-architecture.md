# ADR-0024: 컴포넌트 아키텍처 — atoms 위치 / 0 dep / forwardRef / cn() / 시각 검증

- **Status**: Accepted
- **Date**: 2026-05-09 (페이즈 1) / 2026-05-10 갱신 (페이즈 2-A — Spinner 박음 + 사용처 보정 정책)
- **Related**:
  - ADR-0022 (디자인 토큰) — atoms 가 사용하는 토큰 정의.
  - ADR-0023 (Noto_Sans_KR 제거) — fallback chain 결정.
  - 페이즈 1 Commit 3 (이 ADR 의 적용 사례 — Button / Input / Card 첫 박힘).
  - 페이즈 1 Commit 4 (Badge / Modal — 본 ADR 정책 따름).
  - **페이즈 2-A** (Spinner 박음 + `/auth/callback` 인라인 Spinner 2건 교체 — 사용처 보정 첫 사례).
  - 페이즈 2~5 atoms 추가 시 기준점.

---

## Context

### 발견 경위

페이즈 1 Commit 3 (atoms — Button / Input / Card) 진입 사전 점검에서 발견:

- **shadcn 미사용** — `components.json` 부재, `src/components/ui/` 폴더 부재.
- **기존 Button / Input / Card 컴포넌트 0 건** — atoms 가 처음 박히는 케이스.
- **third-party UI 라이브러리 0 건** — Radix / Headless UI / MUI / clsx / tailwind-merge / class-variance-authority / cmdk 모두 미설치.
- **`cn()` helper 부재** — `src/lib/utils.ts` 부재.
- 사이트 raw `<button>`, `<input>` 박혀 있음 — 페이즈 2~5 점진 교체 대상.

### 문제 정의

- 페이즈 1 atoms 가 페이즈 2~5 디자인 작업의 빌딩 블록 — 첫 단추 흔들리면 후폭풍 큼.
- atoms 위치 / 명명 / props 인터페이스 / className merge 정책이 박혀 있지 않으면 페이즈 2~5 마다 결정 반복 → 일관성 손실.
- 0 dep 정책 vs shadcn 표준 dep 도입 — 현 시점에서 dep 도입 비용/효용 결정 필요.
- 시각 검증 부재 — atoms 변경 시 회귀가 어떻게 잡히는지 정책 박혀야 함.

---

## Decision

### 결정 1 — 위치: `src/components/ui/`

- atoms 는 `src/components/ui/<Name>.tsx` 에 박음 (PascalCase).
- 이미 박힌 `src/components/admin/`, `src/components/side-panel/` 은 도메인 컴포넌트 — atoms 와 분리 유지.
- shadcn 표준 위치 — 향후 shadcn 도입 가능성 + atoms 누적 (Badge / Modal / Tooltip 등) 자연 정리.

### 결정 2 — 0 dep 정책

페이즈 1 atoms 박을 때 아래 dep 모두 **미도입**:
- `class-variance-authority` (cva) — variant 패턴.
- `@radix-ui/react-slot` — asChild 패턴.
- `clsx` — conditional className.
- `tailwind-merge` — Tailwind class 충돌 자동 정리.

대신:
- variant 는 **`Record<Variant, string>` 매핑** 으로 박음 (cva 없이).
- className merge 는 `src/lib/utils.ts` 의 **`cn()` 단순 helper** 박음 (`(...inputs).filter(Boolean).join(" ")`).
- asChild 는 미지원.

#### dep 도입 트리거 (향후 검토 시점)

- **`@radix-ui/react-slot` (asChild)**: Link/Anchor 변환 필요 사례 **3 건 이상 누적** 시 도입 검토. 페이즈 2 랜딩 / 페이즈 3 Studio 에서 Button 이 `<Link>` 또는 `<a>` 로 변환 필요한 케이스 발생 시 카운트.
- **`class-variance-authority` (cva)**: variant 매트릭스가 **3 atoms 이상 + 각 4+ variant** 로 복잡해질 때 도입 검토. Record 매핑이 가독성 손실 시점.
- **`clsx`**: conditional className 박는 atoms 가 **5 건 이상 누적** + cn() 의 truthy 필터로 처리 어려운 패턴 (예: object form `{ "class": condition }`) 필요 시 도입.
- **`tailwind-merge`**: Tailwind class 충돌 (예: `p-2 p-4` 동시 박힘) 가 atoms-preview 에서 시각 회귀 발생 시 도입.

### 결정 3 — `forwardRef` + `displayName` 표준

- atoms 모두 `React.forwardRef` 박음 — 호출자 ref 전달 (Form library / scroll target / focus 관리 등).
- `displayName` 명시 박음 — React DevTools 가독성 + ESLint react/display-name 규칙 만족.

```tsx
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { ...props }, ref
) { ... });
Button.displayName = "Button";
```

### 결정 4 — variant / size 객체 매핑 패턴

cva 없이 Record 박음:

```tsx
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  ghost: "bg-transparent text-foreground hover:bg-accent-muted",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

return (
  <button
    className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
    {...props}
  />
);
```

- **base → variant → size → className** 순서로 박음 (호출자 className 이 가장 뒤에 박혀 override 가능).
- 각 variant 매핑은 한 줄 string 또는 `+` join 으로 박음.

### 결정 5 — `cn()` helper (`src/lib/utils.ts`)

```ts
export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(" ");
}
```

- 0 dep, ~3 줄.
- Tailwind class 충돌 자동 정리 안 됨 (tailwind-merge 미도입) — atoms 작성 시 base 와 충돌 안 나도록 신중 박음.
- 호출자 `className` prop 은 항상 마지막 인자로 박아 override 가능하도록.

### 결정 6 — 서브컴포넌트 named export 표준

```tsx
export const Card = forwardRef<...>(...);
export const CardHeader = forwardRef<...>(...);
export const CardContent = forwardRef<...>(...);
export const CardFooter = forwardRef<...>(...);
```

- `Card.Header` 점 표기 namespace 박지 않음 — named export 만.
- 호출 측: `import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card"`.
- 같은 파일 안에 박음 (서브컴포넌트는 부모와 강하게 결합).

### 결정 7 — disabled 시각 처리 (Button 표준)

모든 variant 공통 base class 에 박음:
```
disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
```

- `pointer-events-none` 박아 hover 효과도 차단.
- variant 마다 별도 disabled style 박지 않음 — opacity-50 가 일관 표시.

### 결정 7-bis — Ghost variant 클릭 어포던스: `border-border` 박음 (Commit 3.5 보정)

초안의 ghost = `bg-transparent text-foreground hover:bg-accent-muted` 만으로는 **클릭 어포던스 0** — 다크 배경 위에서 hover 전엔 영역이 보이지 않음 (atoms-preview 시각 검증으로 발견).

**보정**: ghost 에 `border border-border` 추가.
```
ghost: "border border-border bg-transparent text-foreground hover:bg-accent-muted"
```

- secondary (`bg-muted`) 와 시각 차별화 — secondary 는 채워진 면, ghost 는 outline.
- hover 시 `bg-accent-muted` 박혀 더 명확한 인터랙션 표시.
- 라이트 모드에서도 `--border` 토큰이 자동 override 되어 일관 작동.

### 결정 8 — 시각 검증 정책 — `atoms-preview` 페이지 갱신 의무

- `src/app/dev/atoms-preview/page.tsx` — 페이즈 1 Commit 3 에서 박음.
- `/dev/*` 는 proxy.ts (ADR-0018) 의 production 자동 차단 정책 적용 — production 빌드에서 404, dev 환경에서만 접근 가능.
- **atoms 추가 / 변경 시 본 페이지 갱신 의무** — 시각 회귀 잡는 1 차 안전망.
- 향후 visual baseline (페이즈 1 Commit 5) 또는 페이즈 4~5 토글 도입 시 본 페이지에 토글 박음.

#### 강화 사례 1차 (Commit 3.5 — 시각 검증으로 발견된 함정 3 건)

페이즈 1 Commit 3 직후 atoms-preview 시각 확인에서 본 ADR 의 정책이 의도대로 작동:

| # | 함정 | 발견 경위 | 보정 |
|---|------|-----------|------|
| 1 | Input autofill 시 브라우저가 토큰 무시 → 연보라 배경 | atoms-preview 의 Input 매트릭스에 autofill 트리거 시점 발견 | `globals.css` 에 `input:-webkit-autofill` override 박음 (사이트 전역 input 보호) |
| 2 | Ghost Button 영역 시각적으로 안 보임 (클릭 어포던스 0) | atoms-preview 의 ghost 행이 빈 셀처럼 보임 | 결정 7-bis 박음 (`border border-border` 추가) |
| 3 | atoms-preview 데모 코드의 Card 내부 버튼 size="sm" 부적절 | atoms-preview 자체 검토 | 데모 코드 size="md" 로 보정 (atoms 본체 문제 아님) |

#### 강화 사례 2차 (Commit 4.5 — Badge 시각 검증)

페이즈 1 Commit 4 직후 atoms-preview 시각 확인에서 발견된 함정 3 건:

| # | 함정 | 발견 경위 | 보정 |
|---|------|-----------|------|
| 1 | Badge 가 grid 안에서 행 풀로 박힘 (가로 100%) | atoms-preview 의 grid cell 이 stretch 박혀 inline-flex 의도 묻힘 | 데모 페이지 grid → flex 변경 + Badge base 에 `justify-center whitespace-nowrap` 보강 |
| 2 | Badge size 가 라벨에 비해 큰 사이즈 | sm/md 에 height 미명시 → 실제 텍스트 사이즈만으로 박힌 사이즈가 라벨 의도보다 큼 | size Record 갱신: `sm = h-5 px-2 text-xs`, `md = h-6 px-2.5 text-sm` (작은 캡슐 라벨 표준) |
| 3 | Outline variant border 가 다크 배경 위에서 약함 | `--border` (zinc-800) 가 다크 배경 (#0a0a0a) 대비 매우 약함 | Badge outline 한정 `border-foreground/20` 박음 (ADR-0022 토큰 보정 보류, Badge 한정 처리) |

##### Badge 정책 박제 (Commit 4.5 결과)

- **base 클래스**: `inline-flex items-center justify-center whitespace-nowrap` — Badge 가 inline 컨텍스트에서 의도대로 박힘 보장.
- **size scale**: 작은 캡슐 라벨 표준 (h-5 / h-6) — Button 의 size 와 분리. Badge 의 의도된 사용 (텍스트 옆 라벨, "NEW" / "Beta" / "Error" 등) 에 부합.
- **outline border 톤**: Badge 한정 `border-foreground/20` 박음 — 다크/라이트 호환 + 토큰 의존성 없음.
- **`--border` 토큰 자체 보정**: 보류 (페이즈 2~5 다른 outline 컴포넌트 발생 시 일괄 결정 — ADR-0022 갱신 트리거).

**메타 회귀**: atoms-preview 시각 검증이 atoms 자체의 함정을 두 번째로 잡아냄 — 결정 8 의 "시각 회귀 1 차 안전망" 정책이 atoms 박힐 때마다 작동. visual baseline (페이즈 1 Commit 5) 박기 전 atoms 정상 상태 확정 필수 — 버그 박힌 채로 baseline 박으면 회귀 슈트가 버그를 "표준" 으로 인식하고 페이즈 2~5 보정 시 baseline 깨짐 = 회귀 안전망 의미 없음.

### 결정 8-bis — Modal 정책 (Commit 4 박음)

페이즈 1 Commit 4 에서 Modal 박을 때 0 dep 정책 (결정 2) 유지 + 다음 5 항목 박음:

#### a. 0 dep 직접 구현
- Radix Dialog / Headless UI Dialog 미도입.
- ESC / backdrop click / body scroll lock / 포커스 복원 / aria 모두 직접 박음.
- `createPortal` 은 React 표준 (dep 추가 없음).

#### b. createPortal 사용 정책
- `createPortal(content, document.body)` — Modal 이 부모 컴포넌트의 z-index / overflow 영향 받지 않음.
- **SSR 호환 가드**: `useEffect + useState(mounted)` 패턴. 첫 렌더 시 `document` 미정의이므로 `mounted = false` → null 반환, hydration 후 `mounted = true` 박힘.

#### c. 포커스 트랩 미박음 (도입 트리거 명시)
- 페이즈 1 범위 외 — 50~100 줄 추가 박는 무거운 부분.
- **도입 트리거**: Modal 접근성 이슈 보고 누적 시 또는 페이지 작업 중 포커스 이탈 사례 발생 시.
- 발동 시 별도 commit + ADR-0024 갱신 (또는 신규 ADR).

#### d. z-index 정책
- backdrop + content: `z-50`.
- 페이즈 2~5 진행 중 다른 fixed 요소 (Header / FloatingButton 등) 와 충돌 시 ADR-0024 갱신.
- 현 사이트의 fixed 요소 점검: `FloatingInquiryButton` (랜딩 우하단), `Header` (랜딩 fixed) — z-50 보다 낮은 순위로 박혀 있어 충돌 없음 (페이즈 1 시점).

#### e. backdrop 톤 — `bg-black/50`
- LEE 명시 후보 2 종 중 채택:
  - **`bg-black/50` ⭐**: 다크/라이트 모드 모두 어둡게 가림 — 표준 패턴, 모드 일관.
  - `bg-foreground/40` 비채택: 다크 모드에서 foreground=흰색이라 backdrop 이 흰색 반투명 → 의도 반대.
- 별도 토큰 (`--backdrop`) 박지 않음 — Modal 만 사용하는 색상, over-engineering 회피.

#### f. imperative API — Modal root 는 forwardRef 미박음 (결정 3 의 예외)
- `Modal` root 는 `open` / `onClose` props 받는 imperative 패턴 — ref 부여 의미 없음.
- 서브컴포넌트 (`ModalHeader` / `ModalContent` / `ModalFooter`) 는 일반 div 라 forwardRef + displayName 박음.

### 결정 9 — 페이즈 2~5 atoms 추가 시 따를 정책

- 위치: `src/components/ui/<NewAtom>.tsx`.
- 0 dep 정책 유지 — 결정 2 의 도입 트리거 충족 시 별도 ADR 갱신.
- forwardRef + displayName 박음.
- variant / size 가 있다면 Record 매핑.
- `cn()` 사용.
- atoms-preview 페이지에 새 atoms 섹션 추가 (시각 검증 의무).
- 서브컴포넌트가 있으면 named export.

### 결정 10 — Spinner 정책 (페이즈 2-A 박음)

페이즈 2-A 에서 atoms 6 번째로 박음 — 단일 variant, size 만 분기.

#### a. 단일 variant (variant 없음)

- 로딩 상태 표시는 시각 톤 분기가 의미 없음 — 단일 형태 유지.
- 색상은 `text-accent` 토큰 매핑 + className override 로 호출처별 보정 가능 (예: 빨간 영역에서 `text-destructive` override).

#### b. size scale: sm (h-4) / md (h-6, default) / lg (h-10)

- sm: 텍스트 옆 인라인 ("분석 중..." 옆 박음).
- md: 카드 내부 / 버튼 로딩 / 일반 컨테이너 (default).
- lg: 풀스크린 로딩 (예: `/auth/callback` 의 OAuth 교환 대기) — Button 의 `lg` 와 사이즈 일치 안 함 (Spinner 의 의도된 사용 ≠ Button).

#### c. currentColor 기반 토큰 매핑

```
border-2 border-current/20 border-t-current text-accent
```

- `text-accent` → `currentColor` = 잉크 블루.
- `border-current/20` → ring 은 currentColor 의 20% 투명도 (Tailwind v4 의 `current/20` 박음).
- `border-t-current` → top 만 full currentColor → 회전 시 시각 효과.
- 호출처에서 `<Spinner className="text-destructive" />` 박으면 빨간색 spinner — 토큰 의존성 끊지 않고 색상만 override.

#### d. role="status" + aria-label

- `role="status"` 표준 — 스크린 리더가 로딩 상태 인식.
- `aria-label` default: "로딩 중" — `label` prop 으로 override 가능 (예: "분석 중", "저장 중").

#### e. forwardRef 박음 (결정 3 일관)

- imperative 패턴 (Modal 의 결정 8-bis (f)) 박지 않음 — Spinner 는 일반 요소.
- HTMLSpanElement 기반 (`<span>` + `inline-block` — 텍스트 옆 박을 수 있도록).

### 결정 11 — atoms 사용처 보정 정책 (페이즈 2-A 박음)

페이즈 2-A 의 첫 사용처 보정 사례:

#### 사례 — `/auth/callback/page.tsx` 의 인라인 Spinner 2건 → Spinner atom 교체

| 위치 | 박힌 코드 | 보정 |
|---|---|---|
| line 14-22 (메인 로딩 컴포넌트) | `<div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />` | `<Spinner size="lg" />` |
| line 96-100 (Suspense fallback) | 동일 인라인 박음 | `<Spinner size="lg" />` |

#### 정책 박음

새 atoms 박힐 때 **이미 박힌 인라인 사용처 (raw 컴포넌트) 가 있으면 같은 commit 에서 교체**:

1. **장점**: atom 추출 + 첫 reuse 검증 + 토큰 매핑 일관 적용 = 단일 commit 에서 검증 회로 닫힘.
2. **단점**: 페이지 디자인 마이그레이션 (페이즈 2-B~) 의 "큰" 변경과 같은 commit 에 박히면 진단 어려움 → **인라인 → atom 교체 만** 박음, 다른 시각 변경 박지 않음.
3. **분리 정책**: 사용처가 페이지 마이그레이션 대상이면 atom 추가 commit 과 페이지 마이그레이션 commit 분리. 인라인 Spinner 처럼 "이미 박힌 사용처" 만 atom 추가 commit 에 박음 (시각 회귀 가드 — 인라인과 atom 의 시각 동등성 검증).

#### Spinner 보정 시 시각 변경 주의

- 기존: `border-zinc-600` (ring) + `border-t-cyan-400` (top) — 잿빛 ring + 시안 top.
- 보정 후: `border-current/20` (ring) + `border-t-current` (top) + `text-accent` (잉크 블루) — 잉크 블루 ring + 잉크 블루 top.
- **시각 톤 변경**: 시안 (`#22d3ee`) → 잉크 블루 (`#2563eb`). 토큰 일관성 ↑.
- baseline 박힌 후 의도된 변경 → snapshot baseline 갱신 (LEE 게이트). 본 사례는 atoms-preview baseline 만 영향 (auth/callback 은 baseline 박지 않음 — phase-1-end snapshot 미포함).

#### 빈틈 박힘 사례 (페이즈 2-A LEE 시각 검증으로 발견)

페이즈 2-A 박은 후 LEE 가 `/auth/callback` 시각 확인 시 **추가 발견 2건**:

| # | 발견 | 보정 처리 |
|---|------|-----------|
| 1 | `/auth/callback/page.tsx` 의 cyan-300 / cyan-200 링크 (`로그인 페이지로 돌아가기`) — 토큰 미적용 하드코딩 색상 | **skip + 처리 시점 박제** |
| 2 | `SITE_NAME` 박힌 "Novel Agent" 텍스트 + 그 아래 별도 박힌 "Novel Agent" 라벨 — 텍스트 중복 박힘 (디자인 의도 불명) | **skip + 처리 시점 박제** |

#### skip 박은 사유 + 처리 시점

**skip 박은 사유**:
- `/auth/callback` 자체가 **곧 마이그레이션 박힐 페이지** (페이즈 2-D 로그인 모달 작업 또는 별도 페이즈) — 곧 사라질 코드의 보정 = ROI 낮음.
- Phase 2-A 깔끔 마무리 (Spinner atom + 인라인 2건 교체 만 박음) 가 commit 진단 명확.

**처리 시점**:
- 페이즈 2-D 로그인 모달 작업 시 `/auth/callback` 의 OAuth 후속 흐름 점검 시점에 일괄 박음.
- 또는 별도 "auth/callback 디자인 마이그레이션" 페이즈 박힐 때 — 본 ADR 의 갱신으로 처리 트리거 박힘.

**박제 이유**: 발견 자체가 자산. 빈틈 박지 않으면 페이즈 2-D 진입 시 잊힘 → ADR 박혀있어야 트리거.

### 결정 12 — atom 추출 시 사용처 보정 범위 + ROI 게이트 (페이즈 2-A LEE 인사이트 박제)

페이즈 2-A 의 빈틈 사례 박힌 후 정책 강화:

#### 사용처 보정 범위 (3 단)

새 atom 추출 시 같은 파일 grep 검색 + 보정 범위 평가:

1. **인라인 컴포넌트** (직접 추출 대상) — 무조건 보정 박음 (atom 추출의 본 목적).
2. **같은 파일의 다른 하드코딩 색상 / 토큰 미적용 영역** — 관련 보정 박음 (ROI 게이트 통과 시).
3. **같은 파일의 다른 하드코딩 패턴** (텍스트 중복, 레거시 패턴 등) — 박지 않음 (atom 추출 범위 외 — 별도 commit 또는 페이지 마이그레이션 시점).

#### ROI 평가 게이트 (박음 vs skip 결정)

같은 파일의 추가 보정 (범위 2) 박을 때 평가:

| 조건 | 결정 |
|---|---|
| 페이지 마이그레이션 임박 (1~2 페이즈 내) | **skip** + ADR 박제 (처리 시점 명시) |
| 페이지 마이그레이션 미박힘 또는 페이즈 5+ | **박음** + atom 추출 commit 에 포함 |
| 페이지 자체가 production 가시성 0 (예: `/dev/*`) | 박음 (기존 atoms-preview 패턴) |
| 페이지가 핵심 사용자 플로우 + 마이그레이션 미정 | **박음** (사용자 가시 시각 일관성 우선) |

#### 빈틈 박지 않기 정책

skip 박은 발견은 반드시 **ADR 박제** — 페이지 마이그레이션 시점 잊히지 않도록:
- ADR-0024 의 "결정 11 빈틈 박힘 사례" 처럼 표 박음.
- 처리 시점 명시 (페이즈 X 또는 별도).
- 박제 안 하면 페이지 마이그레이션 박힐 때 발견 손실 → 같은 빈틈 박힘 반복 위험.

#### 메타 회귀

LEE 시각 검증이 atom 추출 commit 의 빈틈 자체를 잡아냄 — 결정 8 의 "시각 회귀 1차 안전망" 정책이 사용처 보정 commit 에서도 작동. atoms-preview 갱신 + 사용처 시각 확인 박은 LEE 게이트가 commit 진단의 핵심 layer.

---

## Alternatives Considered

### 옵션 A — 위치
- **A1. `src/components/ui/` (채택 ⭐)**: shadcn 표준, 도메인 분리.
- **A2. `src/components/` 직접**: 단순. atoms 누적 시 다시 정리 필요.
- **A3. `src/components/atoms/`**: 명시적 명명. 산업 표준 아님.

### 옵션 B — dep 정책
- **B1. 0 dep (채택 ⭐)**: 단순, dep 추가 비용 0. variant 는 Record, cn 은 단순 join.
- **B2. 최소 (clsx + tailwind-merge)**: cn() helper 표준화, tw class 충돌 자동 정리. dep 2 개.
- **B3. 표준 shadcn (+ cva + Radix Slot)**: variant 패턴 + asChild. dep 4 개.

> 결정 2 의 도입 트리거 충족 시 B1 → B2 → B3 단계적 승격 가능.

### 옵션 C — 서브컴포넌트 패턴
- **C1. named export (채택 ⭐)**: `import { Card, CardHeader }`. 명시.
- **C2. 점 표기 namespace**: `Card.Header`. namespace 객체 박음 — TypeScript 정의 부담.
- **C3. 별도 파일**: `Card/Card.tsx`, `Card/Header.tsx` — 작은 atoms 에 폴더 + 파일 다수 박음. 부담 ↑.

---

## Tradeoffs

받아들인 부담:
- **Tailwind class 충돌 자동 정리 부재** — atoms 작성 시 base/variant 충돌 신중 검토 필요. atoms-preview 가 1 차 안전망.
- **asChild 미지원** — Button 을 `<Link>` 변환 필요 시 별도 컴포넌트 박거나 dep 도입.
- **variant 매트릭스 누적 시 Record 매핑 가독성 저하** — cva 도입 트리거 (결정 2) 발동 시 마이그레이션.

받지 않은 부담:
- **dep 4 개 도입 비용** — 빌드 시간 / 번들 사이즈 / supply chain 리스크.
- **shadcn CLI / 복잡 설정** — components.json + 자동 코드 생성 부담.
- **atoms 첫 도입에서 정책 흔들림** — 결정 박혀 페이즈 2~5 일관성 ↑.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- **dep 도입 트리거 충족** (결정 2):
  - asChild 케이스 3+: Radix Slot 도입.
  - variant 매트릭스 복잡: cva 도입.
  - conditional className 5+: clsx 도입.
  - Tailwind class 충돌 시각 회귀: tailwind-merge 도입.
- **atoms 누적이 30+ 개** 도달 시 shadcn CLI 도입 검토 (자동 코드 생성 효용 상승).
- **명명/패턴 일관성 손실** — 페이즈 2~5 작업 중 다른 패턴 (예: HOC, custom hook 기반 컴포넌트) 이 요구되면 본 ADR 갱신.

---

## Consequences

### 긍정
- 페이즈 1 atoms 가 페이즈 2~5 빌딩 블록 — 일관성 ↑.
- 0 dep — 의존성 비용 0, supply chain 단순.
- forwardRef 표준 — Form / focus / scroll target 자유롭게 박음.
- atoms-preview 페이지 — 시각 회귀 1 차 안전망.

### 영향
- **페이즈 2~5 작업** 이 본 정책 따름:
  - 새 atoms 박을 때 `src/components/ui/` 위치.
  - variant Record 매핑.
  - forwardRef + displayName.
  - atoms-preview 갱신.
- **dep 도입 트리거** 모니터링 의무 — 페이즈 2~3 진행하면서 카운트 누적되는지 점검.
- **raw `<button>`, `<input>` 점진 교체** — 페이즈 2~5 페이지별 마이그레이션 시 atoms 박음.

---

## Future Work

### 단기
- **페이즈 1 Commit 4** (Badge / Modal) — 본 ADR 정책 따름. atoms-preview 갱신.
- **페이즈 1 Commit 5** (visual baseline) — atoms-preview 페이지 baseline 박을 가치 검토.

### 중기
- **페이즈 2 랜딩 작업** — 랜딩 raw `<button>`, `<input>` 을 atoms 로 점진 교체. 카운트.
- **dep 도입 트리거** 발동 시 별도 ADR (ADR-0024 v2 또는 신규 ADR).
- **shadcn CLI 도입** — atoms 30+ 누적 시 검토.

---

## Related Commits

- 페이즈 1 Commit 3 (이 ADR 박는 commit) — Button / Input / Card 첫 박힘 + atoms-preview + cn() helper + 시스템 토큰.
- 페이즈 1 Commit 1 (`393a105`) — render-blocking 절감 (`Noto_Sans_KR` 제거).
- 페이즈 1 Commit 2 (`d7dc53c`) — 디자인 토큰 정의 (ADR-0022).

---

## Notes

### Claude Code 가 관찰한 것

- LEE 의 "Don't add features beyond what task requires" 정책에 0 dep 정책이 자연 부합 — 첫 박음에서 비용 ↓ 효용 충분.
- atoms-preview 페이지 + `/dev/*` proxy guard 는 "production 차단 + dev 검증" 의 깔끔한 조합 — ADR-0018 의 안전망 활용 예시.
- variant Record 매핑은 cva 없이도 명시적 — TypeScript 의 `Record<Variant, string>` 이 enum 강제.

### Claude Code 가 모르는 것

- 페이즈 2~5 진행 중 dep 도입 트리거가 실제 어느 시점에 발동될지 (3 건 누적 추적 의무가 LEE 또는 후속 작업자에게).
- 시각 회귀 (Tailwind class 충돌) 가 atoms-preview 만으로 충분히 잡히는지 — visual baseline (페이즈 1 Commit 5) 박힌 후에 강화될 영역.
