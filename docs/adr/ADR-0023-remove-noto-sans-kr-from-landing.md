# ADR-0023: 랜딩 페이지의 `Noto_Sans_KR` 제거 (페이즈 1 render-blocking 절감)

- **Status**: Accepted
- **Date**: 2026-05-09
- **Related**:
  - 07 pre-phase 1 baseline 측정 (`docs/redesign/07-baseline-pre-phase1.md`) — Render-blocking 700ms 박힘.
  - 페이즈 1 Commit 1 (이 ADR 의 적용 사례).
  - 페이즈 2 랜딩 작업 시 한국어 웹폰트 재도입 검토 (LCP A/B 측정 조건부).

---

## Context

### 발견 경위

페이즈 1 Commit 1 (Render-blocking 700ms 절감) 사전 분석 중 production HTML head 직접 측정에서 식별:

- `src/app/page.tsx` 가 `Noto_Sans_KR` 을 `next/font/google` 로 import 하고 랜딩 메인 wrapper 의 `className` 으로 적용.
- 설정: `subsets: ["latin"]`, `weight: ["600", "700", "800", "900"]`, `display: "swap"`.

### root cause (3 중 모순)

1. **`subsets: ["latin"]` 모순** — Noto Sans KR 는 한국어 폰트인데 latin subset 만 로드. 한국어 글자 (랜딩의 거의 모든 텍스트) 는 fallback 시스템 폰트 (Apple SD Gothic Neo / Malgun Gothic / Noto Sans CJK) 로 표시되고 있었음. **다운로드한 폰트가 한국어 사이트에서 사실상 무용**.
2. **4 weights × unicode-range 분할** — production CSS `e0baa3c693275511.css` = **308 KB**. 이 중 대부분이 Noto Sans KR 의 `@font-face` 선언 + unicode-range 분할 정의 (woff2 파일 다수 분할).
3. **render-blocking + preload 직렬 의존성** — 308 KB CSS 가 `<link rel=stylesheet data-precedence=next>` 로 critical CSS, 폰트 woff2 3 개가 `<link rel=preload>` — 랜딩 hero 의 LCP 가 css/font 직렬 의존 체인 후 렌더.

### 측정 (production novelagent.kr, 2026-05-09)

| 자원 | 사이즈 | 박힘 위치 |
|------|--------|-----------|
| `e0baa3c693275511.css` (Noto Sans KR + Tailwind) | **308 KB** | render-blocking |
| `e1d50fdb335e591b.css` (Geist + page CSS) | 88 KB | render-blocking |
| 폰트 woff2 × 3 preload | 26~31 KB each | preload |

Lighthouse 진단의 Render-blocking requests 700ms 의 거의 전량을 단일 root cause 가 차지.

### 문제 정의

- LCP 3.9s = 페이즈 1 baseline 의 최대 약점 (Performance 점수 가중치 25%).
- Newsreader serif 폰트를 페이즈 2 에 도입하려는데 현재 LCP 상태에서 추가 폰트는 LCP 를 더 악화시킬 위험 — Noto Sans KR 만이라도 우선 정리해서 LCP headroom 확보 필요.
- 1 인 운영 환경에서 한국어 웹폰트 도입은 시각적 품질 향상 대비 **사이즈/LCP 비용** 이 매우 큼 — 시스템 폰트 fallback 이 실용적.

---

## Decision

### 결정

`src/app/page.tsx` 에서 `Noto_Sans_KR` import + 변수 선언 + className 적용을 **제거**. 한국어 글자는 시스템 폰트 fallback 으로 표시.

### 동작 요약

**변경 전** (`page.tsx`):
```tsx
import { Noto_Sans_KR } from "next/font/google";
const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});
// ...
<main className={`${notoSansKr.className} flex min-h-screen ...`}>
```

**변경 후**:
```tsx
// import 제거
// 변수 선언 제거
<main className="flex min-h-screen ...">
```

총 변경: `page.tsx` 3 줄 (import 1, 변수 선언 4 줄, className 1).

### 근거

- 한국어 글자는 이미 fallback 으로 표시되고 있었음 → **시각 영향 거의 0** (랜딩 한국어 글자체가 약간 시스템 폰트로 변경되지만 이전에도 fallback 동일).
- 영문 글자는 layout.tsx 의 Geist 가 적용되고 있어 그대로 유지.
- root cause 가 단일 — 단일 commit 으로 700ms 의 거의 전량 회수 가능.
- 페이즈 1 토큰 정의 (Commit 2) 에서 `--font-sans` 의 fallback chain 에 한국어 시스템 폰트를 명시적으로 박을 예정 — 본 commit 이 그 사전 단계.

---

## Alternatives Considered

### 옵션 A — `subsets: ["korean"]` 로 변경 (한국어 subset 로드)
- **장점**: 의도대로 Noto Sans KR 가 한국어 글자에 적용 — 시각적 일관성.
- **단점**:
  - 한국어 polyglot subset 은 Latin subset 보다 폰트 파일이 매우 큼 (~수 MB 단위 woff2 분할).
  - LCP 가 더 악화될 위험 (현재 700ms 가 더 늘어남).
  - 한국어 시스템 폰트와의 시각적 차이가 작음 (Apple SD Gothic Neo 등도 가독성 우수).
- **결론**: 비채택. ROI 음성 (LCP 비용 ↑ 시각 이득 ↓).

### 옵션 B — `display: "optional"` 로 변경 (swap → optional)
- **장점**: fallback 즉시 사용, 폰트 늦게 도착하면 swap 안 함 — LCP 친화.
- **단점**: subsets:latin 모순 그대로 → 다운로드 자체가 여전히 무용. CSS 308 KB 도 그대로.
- **결론**: 부분 해결, root cause 미해결.

### 옵션 C — weight 줄이기 (예: 600, 800 만)
- **장점**: 작은 절감.
- **단점**: 4 weights → 2 weights 라도 unicode-range 분할 woff2 가 weight 별 박혀 308 KB CSS 의 50~60% 만 절감 추정. 부분.
- **결론**: 부분 해결.

### 옵션 D — `Noto_Sans_KR` import 제거 (채택 ⭐)
- **장점**:
  - 단일 commit, 3 줄 변경, 검증 빠름.
  - 700ms render-blocking 의 거의 전량 회수.
  - 시각 영향 거의 0 (한국어 글자는 이미 fallback).
  - 페이즈 2 랜딩 작업 시 한국어 웹폰트 재도입 검토 가능 (LCP A/B 조건부).
- **단점**:
  - 한국어 글자체가 시스템 폰트로 표시 — 랜딩 hero 가 약간 다른 인상 (단 이전에도 fallback 이라 사실상 동일).
- **결론**: 채택.

---

## Tradeoffs

받아들인 부담:
- 한국어 시각 일관성 — 시스템 폰트 fallback 으로 OS 별 폰트 차이 발생 (Apple SD Gothic Neo / Malgun Gothic / Noto Sans CJK 등). **단 이전에도 fallback 이라 실질 영향 0.**
- 페이즈 2 에서 한국어 웹폰트 재도입 시 별도 measurement + 결정 필요 (LCP A/B).

받지 않은 부담:
- LCP 추가 악화 (옵션 A 의 한국어 subset 로드 시 위험).
- 부분 해결 후 잔여 절감을 별도 commit 으로 분산하는 비용 (옵션 B/C).
- 현재 무용한 폰트 다운로드 + 308 KB CSS 의 파싱 비용.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- **페이즈 2 랜딩 작업** 시 디자인 의도가 한국어 웹폰트 적용을 강하게 요구 + LCP A/B 측정에서 추가 폰트 도입이 LCP 를 acceptable 범위 (예: 3.0s 이하) 로 유지 가능 시 → 한국어 웹폰트 재도입.
- **한국어 시스템 폰트 품질 차이** 가 사용자 피드백에서 명확한 부정 신호 시.
- **CDN 또는 Variable Font 도입** 으로 한국어 웹폰트의 LCP 비용이 의미 있게 줄어들 시.

---

## Consequences

### 긍정
- Render-blocking 700ms 의 거의 전량 회수 (예상).
- LCP 단축 — 페이즈 1 의 최대 약점이 즉시 해결될 잠재 효과.
- 페이즈 2 에서 Newsreader serif 도입 시 LCP headroom 확보 (페이즈 1 baseline 의 결정과 정합).
- 308 KB CSS → 추정 50~80 KB 로 감소 — 모바일/저속망 사용자 큰 이득.

### 영향
- production 배포 후 재측정 필수 (Performance 점수 / LCP / Render-blocking ms).
- 페이즈 2 진입 직전 Lighthouse 재측정 — 본 commit 의 실제 절감 정량화.
- 페이즈 2 랜딩 작업 시 한국어 웹폰트 재도입 결정 게이트 명시 (ADR-0023 의 Revisit Criteria 참조).

---

## Future Work

### 단기
- **페이즈 1 Commit 2 (토큰 정의)** 에서 `--font-sans` fallback chain 에 한국어 시스템 폰트 명시적 박음:
  ```css
  --font-sans: var(--font-geist-sans), -apple-system, "Apple SD Gothic Neo",
               "Malgun Gothic", "Noto Sans CJK KR", system-ui, sans-serif;
  ```
- **페이즈 1 종료 시점** Lighthouse 재측정 — 절감 수치 박제 (`docs/redesign/08-phase-1-completion.md`).

### 중기
- **페이즈 2 랜딩 작업** 시 한국어 웹폰트 재도입 LCP A/B 측정 (Revisit Criteria 충족 검증).
- 다른 페이지 (`/login`, `/studio`, `/pricing` 등) 의 폰트 로딩 패턴 점검 — Noto_Sans_KR import 가 또 박혀 있는지 확인.

---

## Related Commits

- (이 ADR 박는 commit 본문 — 페이즈 1 Commit 1).

---

## Notes

### Claude Code 가 관찰한 것 (이번 분석)
- `next/font/google` 의 `Noto_Sans_KR` 사용 시 `subsets:["latin"]` 만 박는 게 일반적 함정 — IDE 자동완성이 "latin" 을 default 로 제시.
- 한국어 사이트인데 한국어 폰트를 latin subset 만 로드하는 모순은 정적 분석 도구 (예: Lighthouse, eslint-plugin-next) 가 잡아내지 못함.
- production 측정 (curl + 폰트 사이즈 + CSS 사이즈 직접 확인) 이 root cause 식별의 핵심 단계 — Lighthouse 점수만으로는 단일 root cause 까지 도달 어려움.

### Claude Code 가 모르는 것
- 본 결정 적용 후 production 의 실제 Lighthouse 재측정 결과 (commit 시점에 측정 안 됨, LEE 가 페이즈 1 종료 후 측정).
- 한국어 시스템 폰트의 OS 별 시각 차이 가 사용자에게 어느 정도 인지되는지 (사용자 피드백 부재).
