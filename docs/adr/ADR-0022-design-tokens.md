# ADR-0022: 디자인 토큰 정의 정책 (페이즈 1 — 색상 + 타이포)

- **Status**: **Accepted (v3 — LEE 잔여 2 건 결정 반영)**
- **Date**: 2026-05-09
- **Related**:
  - 페이즈 1 Commit 2 (이 ADR 의 적용 사례).
  - ADR-0023 (랜딩 `Noto_Sans_KR` 제거) — fallback chain 의 사전 단계.
  - 07 pre-phase 1 baseline (Newsreader serif 의 LCP 영향 대비).
  - 페이즈 2~5 작업의 색상/타이포 기준점 — 본 ADR 이 흔들리면 후폭풍 큼.

---

## Context

### 발견 경위

페이즈 1 Commit 2 (색상 + 타이포 토큰 정의) 진입 시점에 LEE 의 6 결정 (시그니처 액센트 잉크 블루 / Newsreader 토큰만 선언 / `@theme` 하이브리드 / 페이즈 1 범위 등) 을 코드 토큰으로 박는 정책 결정 필요.

### 현재 토큰 상태 (점검 결과)

- **다크모드 토글 부재**: `next-themes` 미설치, `useTheme` 0 건, `dark:` 클래스 0 건, `:root.dark` 0 건.
- **사이트 동작**: 사이트 전체 강제 다크 (`--background: #0a0a0a` / `--foreground: #fafafa`), 어드민만 별도 라이트 톤.
- **globals.css 토큰 분포**:
  - `:root` 에 전역 background/foreground.
  - `@theme inline` 블록에 사이드 패널 토큰 (액센트 `#6366f1` 인디고) + 역할 뱃지 + 어드민 토큰 (액센트 `#2563eb` blue-600).
  - hex 직박 다수.
- **`body` 폰트**: `var(--font-sans), system-ui, sans-serif` — fallback chain 일부 박힘.

### 액센트 색상 후보 분석

LEE 결정 = **"잉크 블루 (sky 240 계열)"** — 정확한 hex 미명시. 후보:

| 후보 | hex | HSL | 메모 |
|------|-----|-----|------|
| **A. Tailwind blue-600 ⭐** | `#2563eb` | (221, 83%, 53%) | 어드민 액센트 (`--color-admin-accent`) 와 일치 — 사이트 통합 |
| B. Tailwind blue-700 | `#1d4ed8` | (224, 76%, 48%) | 더 진한 잉크 톤, 다크 배경 대비 약화 우려 |
| C. 커스텀 잉크 | `#1F66CC` | (215, 73%, 46%) | sky 톤 약간 섞임, 어드민과 불일치 |
| D. Tailwind indigo-700 | `#4338ca` | (243, 58%, 51%) | 인디고 — 사이드 패널 (`#6366f1`) 과 충돌 |

### 문제 정의

- 페이즈 1 토큰이 페이즈 2~5 디자인 작업의 기준점이 됨 — 첫 단추 흔들리면 후폭풍 큼.
- 색상 토큰 3 단 구조 (`accent` / `accent-foreground` / `accent-muted`) 의 의미 정의 + 사용 가이드 박아야 후속 작업이 일관됨.
- Newsreader 도입은 LCP 위험 (07 baseline 의 시사점) — 토큰만 박고 실 적용 보류 정책 박힘 필요.
- fallback chain 박지 않으면 ADR-0023 의 한국어 시스템 폰트 fallback 약속이 코드에 반영 안 됨.

---

## Decision

### 결정 1 — 시그니처 액센트: **Tailwind blue-600 (`#2563eb`)** 채택

- 어드민의 `--color-admin-accent: #2563eb` 와 동일 — 사이트 통합성 확보.
- HSL (221, 83%, 53%) — 다크 배경 (`#0a0a0a`) 대비 WCAG AA 충족.
- Tailwind 표준 색상 — 추후 색상 시스템 확장 시 무리 없음.

> **명명 정책 박제**: 초기 설계 시 LEE 가 "**sky 240 계열**" 표현 사용. Tailwind 팔레트상 정확한 위치는 **blue-600** (`#2563eb`). 어드민과의 일관성 위해 sky 색군이 아닌 blue 색군 채택. **"잉크 블루" 컨셉 명칭은 유지**, 코드/토큰 명세는 blue-600 으로 박음. 향후 컴포넌트 명세 / 디자인 doc 에서도 "잉크 블루 = blue-600" 동치 박음.

### 결정 2 — `--color-accent` **4 단 구조** (3 단 → 4 단 재구조)

```css
--color-accent: #2563eb;             /* base — 버튼 / 링크 / focus ring */
--color-accent-foreground: #ffffff;  /* accent 위 글자 */
--color-accent-hover: #1e40af;       /* hover state — Tailwind blue-800 */
--color-accent-muted: #dbeafe;       /* 옅은 배경 / 디스에이블 — Tailwind blue-100 */
```

4 단 사유 (LEE 결정):
- **accent**: primary CTA / 링크 / focus ring 등 강조.
- **accent-foreground**: accent 위에 박히는 글자 (흰 글자가 다크/라이트 모두 대비 최적).
- **accent-hover**: 진한 호버 / pressed state (`accent` 보다 한 단계 진한 톤).
- **accent-muted**: 옅은 배경 / 디스에이블 / 통보 banner subtle (`accent` 보다 매우 옅은 톤).

> 초안의 3 단 구조 (`accent` / `accent-foreground` / `accent-muted=#1e40af`) 는 **muted 의미 충돌** 우려 (shadcn 패턴은 `muted` = 옅은 배경, hover 와 별개). 한 토큰에 묶으면 페이즈 2~5 내내 의미 혼란 → 분리.
>
> - **hover** = blue-800 `#1e40af` (accent base 보다 어두움)
> - **muted** = blue-100 `#dbeafe` (accent base 보다 매우 밝음)

### 결정 3 — `@theme` + CSS variables 하이브리드 (현 패턴 유지)

- 원본 색상 변수는 `:root` 에 박음 (다크 톤 — 페이즈 1 시점).
- Tailwind 노출용 매핑은 `@theme inline` 블록에 박음 (`--color-accent: var(--accent)` 패턴).
- `inline` 키워드는 Tailwind v4 옵션 — 변수 참조를 inline 으로 풀어 박아 향후 다크모드 토글 추가 시 override 정상 작동.

### 결정 4 — 다크모드: **B 채택 (dark first / light override) + 토큰 + override 박음, 토글 메커니즘만 페이즈 4~5**

- **사이트 (강제 다크) + 어드민 (강제 라이트) 공존** 상태에서 통합 정책 수립 필요 — 본 ADR 은 **토큰 선언만** 박음 (실 토글은 페이즈 4~5 별도 이슈).
- **`:root` + `:root.light` override 둘 다 정의** — 어차피 토큰 박을 거면 라이트 톤도 결정해두는 게 페이즈 2~5 작업 효율.
- **default 패턴 = B (dark first / light override)** — `:root` = 다크 (현 사이트 동작 보존, 코드 변경 0), `:root.light` = 라이트 override.
- **토글 메커니즘은 페이즈 4~5 무렵 별도 이슈에서 결정** — `next-themes` 도입 시점 / `<html class="light">` 박는 위치 / 어드민 강제 라이트와의 통합 정책.

> **현 사이트 강제 다크 동작 보존 + 어드민 강제 라이트는 별도 이슈** — 페이즈 4~5 다크모드 토글 도입 시점에 `:root.light` override 활성 + 어드민 분기 정책 재결정 (`--color-admin-*` 토큰 통합 또는 분리 유지).

#### 4 단 토큰의 라이트/다크 (LEE 결정 hex, Decision 3 분리 패턴 적용)

원본 변수는 짧은 이름 (`--accent` 등) 으로 `:root` 에 박고, Tailwind 노출용 매핑은 `@theme inline` 블록에서 `--color-accent: var(--accent)` 패턴 — 다크모드 override 가 자동 작동하는 구조.

```css
:root {
  /* 다크 톤 (현 사이트 default — 코드 변경 0) */
  --accent: #3b82f6;             /* blue-500 — 다크 배경 위 가독성 ↑ */
  --accent-foreground: #f8fafc;  /* slate-50 — eye fatigue 완화 */
  --accent-hover: #60a5fa;       /* blue-400 — 다크 hover 는 밝아지는 방향 */
  --accent-muted: #1e3a8a;       /* blue-900 — 다크 배경의 subtle 박스 */
}

:root.light {
  /* 라이트 override — 페이즈 4~5 토글 도입 시 활성 */
  --accent: #2563eb;             /* blue-600 */
  --accent-foreground: #ffffff;
  --accent-hover: #1e40af;       /* blue-800 — 라이트 hover 는 어두워지는 방향 */
  --accent-muted: #dbeafe;       /* blue-100 */
}

@theme inline {
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-hover: var(--accent-hover);
  --color-accent-muted: var(--accent-muted);
  /* ... 폰트 토큰 + 기존 사이드 패널/역할/어드민 토큰 ... */
}
```

→ Tailwind 의 `bg-accent`, `text-accent-foreground`, `hover:bg-accent-hover`, `bg-accent-muted` 클래스가 자동 생성됨.

#### hover 방향 정책 (LEE 결정 박제)

- **라이트 모드**: `accent` (base) → `accent-hover` 가 **어두워지는 방향** (`blue-600` → `blue-800`). 라이트 배경 위에서 base 보다 진해야 hover 인지.
- **다크 모드**: `accent` (base) → `accent-hover` 가 **밝아지는 방향** (`blue-500` → `blue-400`). 다크 배경 위에서 base 보다 밝아야 hover 인지 — Material Design / Tailwind 공식 다크 패턴.
- 초안의 추정값 (`blue-500` → `blue-600`) 은 다크 hover 가 어두워지는 방향 — base 가 배경에 묻혀 "사라지는 방향" → 부적합. **LEE 수정 박힘**.

#### 디자인 시안 부재 — 추정값 채택 정책 박제

- `docs/redesign/` / `docs/admin-handoff/` 양쪽 모두 디자인 시안 zip 부재 (Claude Code 점검 확인).
- 추정값 = shadcn 표준 다크 패턴 + LEE 의 hover 방향 정책.
- **페이즈 2~3 atoms 시각 검증 시 미세 조정 가능** — 본 ADR 의 hex 가 atoms 박힌 후 시각 검토에서 부적절 판정되면 별도 commit 으로 조정 (ADR 의 Revisit Criteria 참조).

### 결정 5 — 폰트 토큰 + fallback chain

```css
--font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont,
             "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic",
             "Noto Sans CJK KR", system-ui, sans-serif;

--font-serif: "Newsreader", "Source Serif Pro", Georgia, serif;
/* ⚠️ 토큰 선언만 — 실 import 는 페이즈 2 랜딩 작업 시 LCP A/B 측정 후 결정. */

--font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Monaco, monospace;
```

#### fallback chain 사유
- **`var(--font-geist-sans)`**: layout.tsx 에서 박힌 Geist (라틴 우선).
- **`-apple-system, BlinkMacSystemFont, "Segoe UI"`**: macOS/iOS, Windows 영문 시스템 폰트.
- **`"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR"`**: macOS/iOS, Windows, Linux/Android **한국어** 시스템 폰트 — ADR-0023 의 약속 이행.
- **`system-ui, sans-serif`**: 최종 fallback.

### 결정 6 — Newsreader 토큰만 선언, 실 적용 보류 + 측정 기준 박음

- Newsreader serif 폰트는 **토큰 선언만** 박음 (`--font-serif`).
- `next/font/google` 의 `Newsreader` import 는 박지 않음.
- 페이즈 2 랜딩 작업 시점 **mid-phase Lighthouse A/B 측정** 후 채택 결정.
- **측정 기준 (LEE 결정)**:
  - **LCP +200 ms 이내**: 채택 (Newsreader import + 헤드라인/본문 적용).
  - **LCP +200 ms 초과**: **미채택** 또는 **헤드라인 한정** 범위 축소 (e.g. h1/h2 만 적용, 본문은 sans).
- 07 baseline 의 LCP 3.9s 가 최대 약점이라 추가 폰트 도입은 위험 — 페이즈 1 의 render-blocking 절감 (Commit 1 `393a105`) 효과 production 측정 후 판단.

### 결정 7 — LCP 처리 정책: next/image 적용 보류 (페이즈 2-B-4 박음)

페이즈 2-B-4 풀 마이그레이션 시점, 시안 (`design_novel/novel-agent/landing.jsx`) 검토 결과 — **시안 자체가 텍스트/border 중심의 미니멀 디자인이라 이미지 자산이 거의 없음**:

- ambient radial gradient — CSS only (oklch)
- 헤더 로고 — 인라인 SVG
- HeroSampleReport (LiveScoreCard) — 데이터 시각화, 이미지 0
- Features 3 카드 — 텍스트 + border + accent line
- How it works 4 카드 — 번호 + 텍스트
- CTA / Footer — 텍스트 only

#### 결정

- **next/image 적용 보류** — 적용 대상 이미지 자체가 없음.
- **fetchpriority="high" 보류** — LCP element 가 H1 텍스트 또는 LiveScoreCard (데이터 컴포넌트) 로 추정. 이미지 우선순위 부여 대상 없음.
- **LCP < 2.5s 통과 가능성 검증 방식**:
  - 페이지 1 끝 LCP 2.6s.
  - 이미지 제거 + 텍스트/border 중심 디자인 = 자연스러운 LCP 개선 가능.
  - 페이즈 2-B-4 끝 mid-phase Lighthouse 측정으로 검증.
  - production preview 환경 (`npm run build && npm run start`), Mobile Slow 4G, Pre baseline 동일 조건.

#### Revisit Criteria

LCP < 2.5s 미통과 시:
- 페이즈 2-C (Newsreader 도입) 의 LCP A/B 측정과 묶어서 종합 판단.
- 페이즈 5 (Analysis Report) 박힐 때 데이터 시각화 영역에서 이미지 도입 가능성 — 그 시점에 next/image 정책 재검토.
- Newsreader 의 +200ms 영향 (결정 6) 이 임계 박음 → Newsreader 미채택 또는 헤드라인 한정 결정 우선.

#### Hero stats 영역 — 100명 트리거 박제 (LEE 의도)

페이즈 2-B-4 의 Hero stats 영역 카피:
- "베타 운영 중 · 가입 즉시 20 NAT"
- "장르별 에이전트 6종 · 6축 분석"
- "평균 분석 시간 42초"

시안의 mock 통계 ("2,400+ 작가 사용 중" 등) 는 실제 데이터가 아니라 마케팅 윤리 위험 — 정확한 카피로 대체. **단 영역 자리는 유지** — 작가 100명 도달 시 첫 stat 을 "작가 N명 사용 중" 으로 변경 예정. 100명 트리거 시점 도달 시 본 ADR 갱신 또는 별도 commit 으로 처리.

#### CTA NAT 보너스 — 카피 vs 지급 정책 분리 (LEE 결정)

시안 카피 "30 NAT" → "20 NAT" 변경. 시안 명세는 30 NAT 일회성 가입 보너스, 현재 정책은 베타 무료 + 주 3 NAT 정기 지급 (CLAUDE.md 박음).

페이즈 2 묶음 push 정책으로 production 영향 0:
- 페이즈 2-B-4 commit: 카피만 "20 NAT" 박음.
- 페이즈 2-F 끝 + main 머지 직전: 실 가입 NAT 지급 정책도 20 NAT 로 변경 (별도 작업 또는 페이즈 2-F 의 본 commit 에 통합).
- 가입 NAT 지급 정책 박힌 위치 (Supabase 트리거 / 백엔드 코드 / 다른) 는 페이즈 2-D ~ 2-F 진입 시점에 LEE 답 받은 후 처리.
- production 배포 시점에 카피 + 지급 동시 변경되어 사용자 혼란 0.

---

## Alternatives Considered

### 옵션 A — 액센트 hex 결정
- **A1. blue-600 #2563eb (채택 ⭐)**: 어드민과 일치, 사이트 통합.
- **A2. blue-700 #1d4ed8**: 더 진한 잉크, 다크 배경 대비 약화 우려.
- **A3. 커스텀 #1F66CC**: sky 톤 섞임, 어드민과 불일치 → 두 종 액센트 공존하는 모순.
- **A4. indigo-700 #4338ca**: 사이드 패널 인디고 (`#6366f1`) 와 색조 충돌.

### 옵션 B — 다크모드 정책
- **B1 (채택 ⭐)**: 페이즈 1 범위 외 — 토큰만 박음.
- **B2**: 페이즈 1 에 토글 도입 (next-themes 설치 + ThemeProvider 박음). 단점: 페이즈 1 범위 폭증, 회귀 영역 큼, LEE 의도와 불일치.
- **B3**: `:root.dark` / `:root.light` override 만 박고 토글 메커니즘은 페이즈 2 에 도입. 단점: override 작성하지만 작동 안 함 — dead code.

### 옵션 C — Newsreader 처리
- **C1 (채택 ⭐)**: 토큰만 선언, 실 적용 페이즈 2 LCP A/B 후 결정.
- **C2**: 페이즈 1 에 Newsreader import + 적용. 단점: LCP 악화 위험, 07 baseline 의 시사점에 반함.
- **C3**: 토큰도 박지 않고 페이즈 2 시작 시 일괄 결정. 단점: 페이즈 2 가 토큰 + import 둘 다 책임 — 작업 단위 비대.

---

## Tradeoffs

받아들인 부담:
- **다크모드 토글 부재 — 토큰만 박음**: 향후 라이트 모드 추가 시 globals.css 추가 작업 발생.
- **Newsreader 토큰 선언만**: 페이즈 2 에서 LCP A/B 측정 + 결정 작업 1 단계 추가.
- **3 단 액센트 구조**: 사용 가이드 (언제 base/foreground/muted 박을지) 가 후속 작업자에게 학습 비용.

받지 않은 부담:
- **페이즈 1 범위 폭증**: 토글 도입 박으면 회귀 영역 큼.
- **LCP 추가 악화**: Newsreader 즉시 도입 시 페이즈 1 의 render-blocking 절감 효과 (commit 1) 가 상쇄될 위험.
- **사이트 통합 손실**: A2/A3/A4 채택 시 어드민과 다른 액센트 → 두 톤 공존 혼란.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- **LEE 가 다크모드 토글 도입 결정** (페이즈 2/3 시점) → `:root.dark` override 추가, B1 → B2.
- **페이즈 2 LCP A/B 측정에서 Newsreader 도입 가능** → C1 의 토큰을 import 도 박힌 형태로 갱신.
- **블루 600 과 어드민 톤이 디자인 검토에서 부적절 판정** → 액센트 hex 재결정 (모든 페이즈 영향 — 트리거 발생 시 별도 ADR 박음).

---

## Consequences

### 긍정
- 어드민과 일치하는 잉크 블루 — 사이트 통합성.
- 폰트 fallback chain 이 ADR-0023 의 약속 이행 (한국어 시스템 폰트 명시).
- 페이즈 2~5 작업이 본 토큰을 기준점으로 일관 진행 가능.
- 다크모드 토글은 향후 도입 시 `:root.dark` override 만 추가하면 됨 (`@theme inline` 패턴이 이미 호환).

### 영향
- 페이즈 1 Commit 2 후속 작업 (atoms 등) 이 본 토큰 사용을 강제.
- Newsreader 미적용 — 페이즈 2 랜딩 시각 디자인이 sans-serif 만으로 진행. 페이즈 2 LCP A/B 통과 후에야 serif 도입.
- 사이드 패널 인디고 액센트 (`#6366f1`) 와 사이트 잉크 블루 (`#2563eb`) 의 두 액센트 공존 — 사이드 패널이 별도 도메인이라는 점 박혀 있어 OK 이지만, 향후 사이드 패널 액센트도 잉크 블루로 통합 검토 가능 (페이즈 3 시점).

---

## Future Work

### 단기
- **페이즈 1 Commit 3~4 (atoms)**: 본 토큰 사용 — Button accent, Input focus ring, Card border 등에서 `--color-accent` 박음.
- **페이즈 1 Commit 5 (visual baseline)**: 본 토큰 적용 후 baseline 박음.
- **페이즈 2 진입 직전 Lighthouse 재측정**: render-blocking 절감 효과 + 본 commit 의 토큰 도입 영향 확인.

### 중기
- **페이즈 2 랜딩 작업 시 LCP A/B 측정**: Newsreader 도입 전후 LCP 비교 → 도입 결정 또는 추가 보류.
- **페이즈 3 사이드 패널 작업 시 액센트 통합 검토**: 인디고 (`#6366f1`) vs 잉크 블루 (`#2563eb`) — 통합 시 별도 ADR.
- **다크모드 토글 도입 검토** (필요 시): `:root.dark` override + ThemeProvider 박음.

---

## Related Commits

- 페이즈 1 Commit 1 (`393a105`) — Noto_Sans_KR 제거 (본 ADR 의 fallback chain 이 그 사후 약속 이행).
- (이 ADR 박는 commit — 페이즈 1 Commit 2, 곧 박힘).

---

## Notes

### Claude Code 가 관찰한 것 (이번 분석)

- 어드민 액센트 `#2563eb` 가 이미 박혀 있어 LEE 의 "잉크 블루 sky 240 계열" 결정과 자연스럽게 일치 — 사이트 통합 기회.
- Tailwind v4 의 `@theme inline` 패턴은 다크모드 toggle 시 `:root.dark` override 가 자동 작동하는 구조 — 페이즈 1 에서 토글 박지 않아도 향후 확장이 깔끔.
- ADR-0023 의 한국어 시스템 폰트 fallback 약속이 본 ADR 의 fallback chain 박힘으로 이행됨 — 두 ADR 간 일관성 박힘.

### Claude Code 가 모르는 것

- LEE 가 "sky 240" 으로 의도한 정확한 색조 (HSL hue 240 의 순수 blue 인지 / Tailwind sky 색군의 240 음영인지 / 일반적 잉크 블루 인지). 본 ADR 은 사이트 통합 + 어드민 일치 우선으로 blue-600 채택.
- 페이즈 2 LCP A/B 측정 시 Newsreader 도입의 실제 LCP 영향 (production 측정 필요).
- 다크모드 토글 도입 시점 (LEE 의 향후 결정).

---

## 검토 흐름 (Draft → Accepted)

LEE 2 차례 검토로 Accepted 박힘:
- **v1 → v2 (LEE 1 차 검토 6 건)**:
  1. 액센트 hex: A1 (`#2563eb` blue-600) 채택 + "sky 240" 명명 정책 박음.
  2. 3 단 → **4 단 구조** (`accent` / `accent-foreground` / `accent-hover` / `accent-muted=blue-100`).
  3. fallback chain 그대로.
  4. `:root` + override 박음, 토글은 페이즈 4~5.
  5. Newsreader 측정 기준 LCP +200ms 박음.
  6. (2 에 통합).
- **v2 → v3 = Accepted (LEE 잔여 2 건)**:
  ① 다크모드 default = **B (dark first / light override)** — 현 사이트 강제 다크 동작 보존.
  ② 다크 override 톤 = 추정값 채택 + **hover 1 건 미세 조정** (`#2563eb` → `#60a5fa` blue-400, 다크 hover 는 밝아지는 방향).

디자인 시안 zip 부재 확인 (`docs/redesign/` / `docs/admin-handoff/` / repo 루트 점검 0 건) — 추정값 채택, 페이즈 2~3 atoms 시각 검증 시 미세 조정 가능.
