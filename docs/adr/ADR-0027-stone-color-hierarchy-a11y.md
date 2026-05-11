# ADR-0027: stone color 위계 정책 + Accessibility 100 추구

- **Status**: Accepted
- **Date**: 2026-05-11 (페이즈 2-B-4.5)
- **Related**:
  - ADR-0022 (디자인 토큰) — stone palette 토큰 정의 + 다크 톤 베이스.
  - ADR-0024 (컴포넌트 아키텍처) — 사용처 보정 정책 (footer 빈틈 사례 #2 가 본 ADR 의 발단).
  - ADR-0026 (Lighthouse 측정 정책) — 본 ADR 의 contrast 검증 도구 + outlier 함정 사례.
  - 페이즈 2-B-4 (`801cda8`) — page.tsx 마이그레이션 시 stone-500 잔존이 들어간 commit.
  - 페이즈 2-B-4.5 — 본 ADR 박는 commit (잔존 stone-500 일괄 보정 + 정책 박제).

---

## Context

### 발견 경위

페이즈 2-B-4 (page.tsx 풀 마이그레이션) 이후 Lighthouse Accessibility 점수 95 발생. 핸드오프 단계에서는 "stone-500 → stone-400 보정 후에도 95 유지" 로 인지하여 "stone-400 도 contrast 미달 (시나리오 C)" 가설을 박았고, ADR 박제 방향도 "a11y 95 acceptable" 로 잡혀있었음.

페이즈 2-B-4.5 의 Lighthouse audit JSON 추출 시 **failing 3 elements 모두 stone-500 잔존 영역**으로 확인. stone-400 자체는 WCAG AA 충분 통과 — 진단 정정.

### 문제 정의

1. **stone palette 위계 정책 부재** — 페이즈 2-B 진행 중 "본문은 stone-200, 부제목/메타는 stone-500" 식의 직관 사용. WCAG 검증 없이 낮은 톤으로 가는 영역이 누적.
2. **stone-500 의 contrast 미달** — Lighthouse 실측 4.12:1, WCAG AA (4.5:1 본문 기준) 미달. 다크 배경 (stone-950) 위에서 보조 텍스트 톤으로 자주 사용되어 a11y 점수 깎임.
3. **잔존 정정 누락 패턴** — 페이지 마이그레이션 시점에 일부 영역만 stone-500 → stone-400 으로 정정되고 나머지 영역이 누락되는 사례 (페이즈 2-B-4 → 2-B-4.5 보정 6건 발생).
4. **a11y 점수 acceptable 기준 모호** — Lighthouse 90+ 통과 / 100 추구 중 정책 없음. 페이즈 2-B-4.5 직전까지는 95 acceptable 방향이었음.

---

## Decision

### 결정 1 — stone palette 위계 표준 (다크 모드, stone-950 배경 기준)

| 톤 | hex | contrast vs stone-950 | 용도 | WCAG AA |
|---|---|---|---|---|
| stone-100 | #f5f5f4 | ~17.4:1 | 헤드라인 / 강조 본문 | 충분 통과 |
| stone-200 | #e7e5e4 | ~14.6:1 | 본문 / nav active | 충분 통과 |
| stone-300 | #d6d3d1 | ~11.7:1 | 본문 보조 / hover state | 충분 통과 |
| **stone-400** | **#a8a29e** | **~7.7:1** | **부제목 / 메타 / 보조 텍스트 / footer 본문** | **충분 통과** |
| stone-500 | #79716b | ~4.12:1 | 본문/보조 톤 사용 금지 — disabled 또는 장식 한정 | **AA 미달** |
| stone-600 | #57534e | ~2.7:1 | border / divider 만 (텍스트 금지) | 텍스트 부적합 |
| stone-700~950 | — | — | 배경 / surface | — |

**핵심 원칙**: 텍스트 톤의 하한은 stone-400. stone-500 이하는 텍스트 용도 금지.

### 결정 2 — stone-500 사용 금지 (예외 2건)

stone-500 은 본문/보조 텍스트에 사용 금지. 다음 2건만 예외:

| 예외 | 사례 | 이유 |
|---|---|---|
| **disabled 상태** | `text-stone-500/60 opacity-60` (예: page.tsx L86 disabled nav) | disabled 자체가 비활성 시각 의도 — contrast 미달이 의도의 일부 |
| **장식 (decoration only)** | hr / divider 라인 / 데코 아이콘 | 의미 전달 텍스트 아님, contrast 검증 대상 외 |

예외 사용 시 코드 주석 의무 — `// disabled / decoration only — stone-500 허용` 박힘.

### 결정 3 — Accessibility 100 추구

페이즈 2-B-4.5 부터 Lighthouse Accessibility 100 을 페이즈 종료 게이트로 박음.

| 점수 | 처리 |
|---|---|
| 100 | 페이즈 종료 가능 |
| 95~99 | failing element 식별 + 본 ADR 의 위계 정책 적용하여 100 회복 |
| 90~94 | 위계 정책 외 다른 a11y 항목 (aria / landmark / button-name 등) 점검 + ADR 갱신 |
| <90 | 페이즈 진입 자체 보류 + 진단 |

acceptable 95 정책 폐기. 95 는 "보정 가능한 빈틈 잔존" 으로 해석.

### 결정 4 — 페이지 마이그레이션 시 a11y 검증 절차

페이지 마이그레이션 commit 직후 다음 절차 박힘:

1. **production build + Lighthouse 측정** (CLI 13.3.0, ADR-0026 결정 1 의 3회 평균).
2. **Accessibility audit JSON 추출** — `r.audits['color-contrast'].details.items` 의 failing element list-up.
3. **stone palette 위계 (결정 1) 적용** — failing element 의 토큰을 stone-400 이상으로 보정.
4. **재측정** — a11y 100 회복 확인.
5. **결정 2 예외 (disabled / decoration) 만 stone-500 잔존 허용** — 다른 모든 stone-500 영역 grep 으로 확인 + 보정.

자동화 명령:
```bash
node -e "
const r = require('/tmp/lh-reports/local-1.json');
const cc = r.audits['color-contrast'];
if (cc.details && cc.details.items) {
  cc.details.items.forEach((item, i) => {
    console.log(i+1, item.node.snippet);
    console.log('  ', item.node.explanation);
  });
}
"
```

### 결정 5 — 페이즈 2-B-4.5 함정 박제

페이즈 2-B-4.5 진단 정정 사례:

| 단계 | 가설 | 정정 |
|---|---|---|
| 핸드오프 단계 | "stone-400 도 contrast 미달 (시나리오 C)" | 부정확 — stone-400 = 7.72:1 충분 통과 |
| 핸드오프 단계 | "a11y 95 acceptable + ADR 박제" | 폐기 — a11y 100 회복 가능 (잔존 stone-500 보정만으로) |
| 페이즈 2-B-4.5 진단 | "stone-500 → stone-400 보정 후에도 95 유지" | 일부 영역만 보정됨 (4건 / 6건 잔존) |

**잔존 stone-500 6건 위치 (페이즈 2-B-4.5 보정 대상)**:

| # | 파일 | 영역 | 보정 후 |
|---|---|---|---|
| 1 | `src/app/page.tsx` L68 | 헤더 sub-label "웹소설 흥행 분석" | stone-400 |
| 2 | `src/app/page.tsx` L150 | Hero stats 부모 div ("베타 운영 중 · 가입 즉시 20 NAT" 등) | stone-400 |
| 3 | `src/app/page.tsx` L181 | Features 섹션 부제목 (max-w-[360px]) | stone-400 |
| 4 | `src/app/page.tsx` L256 | CTA 보조 ("가입 즉시 지급 · 소셜 계정으로 간편 시작") | stone-400 |
| 5 | `src/components/SiteFooter.tsx` L14 | © year SITE_NAME span | stone-400 |
| 6 | `src/components/landing/LiveScoreCard.tsx` L155 | URL mock "novelagent.kr/studio/.../analysis/46" | stone-400 |

**예외 1건 (보존)**: page.tsx L86 disabled nav `cursor-not-allowed text-stone-500/60 opacity-60` — 결정 2 예외 적용.

**Lighthouse failing element vs 잔존 영역 비교**: Lighthouse 가 잡은 3건 (#3, #4, #5) 외 추가 3건 (#1, #2, #6) 이 미검출 상태. 추정 이유:
- #1, #2 — `hidden md:flex` 또는 mobile viewport 외 영역 (Lighthouse mobile preset 가 보지 못함).
- #6 — LiveScoreCard 가 Hero 우측 grid cell 내부, viewport 안에 있으나 자식 요소가 inline color 로 override 가능성.

**교훈**: Lighthouse audit 결과만으로 보정 범위 잡지 말 것. grep 으로 stone-500 잔존 일괄 확인 + 결정 2 예외 외 모두 보정.

---

## Alternatives Considered

### 옵션 A — stone-500 사용 정책
- **A1. 사용 금지 + 예외 2건 (채택 ⭐)**: WCAG AA 강제, 위계 명확.
- **A2. 본문 외 보조 텍스트 허용**: 직관적이나 "보조" 의 정의 모호 → 회귀 우려.
- **A3. 톤 자동 검증 도구 (eslint plugin)**: 효과 ↑, 도입 비용 ↑ — 페이즈 5 이후 검토.

### 옵션 B — Accessibility 점수 정책
- **B1. 100 추구 (채택 ⭐)**: 보정 가능한 빈틈 0 유지.
- **B2. 95 acceptable**: 페이즈 진행 속도 ↑, 빈틈 누적 위험.
- **B3. 90 acceptable**: 페이지 마이그레이션 시점 진단 부담 ↓, 사용자 a11y 영향 ↑.

### 옵션 C — 위계 정책 토큰화
- **C1. Tailwind class 직접 사용 (현 정책 유지)**: 0 dep, 직관적, 위계는 ADR 로 박힘.
- **C2. semantic 토큰 박음** (`text-body / text-meta / text-disabled` 등): 위계 강제 ↑, 토큰 정의 + 마이그레이션 비용 ↑. 페이즈 4~5 검토.

---

## Tradeoffs

받아들인 부담:
- stone-500 사용 금지로 일부 시각 톤 손실 가능 — stone-400 이 약간 더 밝아 "조용한 보조" 톤 약화.
- 예외 2건 (disabled / decoration) 의 코드 주석 의무 — 일관성 강제.

받지 않은 부담:
- semantic 토큰 마이그레이션 (옵션 C2) — 현 시점 ROI 낮음, Tailwind class + ADR 로 충분.
- 자동 검증 도구 (옵션 A3) — 페이지 5+ 누적 시 재검토.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- **stone-400 도 시각 톤 손실이 디자인 의도 훼손 시** — 디자인 페이즈 종합 검토 시점에 보조 텍스트 톤 위계 재구성.
- **다크 모드 외 라이트 모드 도입 시** — stone palette 위계가 라이트 배경에서 다른 contrast 라 위계 별도 박음 필요.
- **semantic 토큰 도입 시** — 본 ADR 의 표를 토큰으로 마이그레이션 + ADR 갱신.
- **Lighthouse audit 외 다른 a11y 도구** (axe-core / WAVE) 도입 시 — 위계 정책 검증 layer 추가.

---

## Consequences

### 긍정
- Lighthouse Accessibility 100 회복 확정 (페이즈 2-B-4.5 직후 95 → 100 검증).
- stone-500 잔존 패턴 차단 — 페이지 마이그레이션 시점의 빈틈 누락 회피.
- 위계 정책이 코드 리뷰 / atom 작성 시 즉시 적용 가능 (표 한 개로 결정).

### 영향
- **페이즈 2-B-5 이후** 모든 페이지 마이그레이션 commit 에 본 ADR 의 검증 절차 (결정 4) 적용 의무.
- **기존 페이지** (스튜디오 / 로그인 / pricing 등) 의 stone-500 잔존 — 페이지 마이그레이션 시점 (페이즈 3+) 에 일괄 정정.
- **atoms 작성 시** stone-500 사용 시 결정 2 예외 주석 의무.

---

## Related Commits

- 페이즈 2-B-4.5 (이 ADR 박는 commit) — 잔존 stone-500 6건 보정 + a11y 95 → 100 회복 + 정책 박제.
- 페이즈 2-B-4 (`801cda8`) — page.tsx 마이그레이션 시 stone-500 잔존 4건 들어간 commit (정정 대상).
- 페이즈 2-B-3 (`1d2d10b`) — LiveScoreCard 추가 시 stone-500 잔존 1건 들어간 commit (정정 대상).
- 페이즈 1 끝 — SiteFooter zinc → stone 마이그레이션 미진행 (정정 대상).

---

## Notes

### Claude Code 가 관찰한 것

- 페이지 마이그레이션 시점의 stone-500 잔존 누락은 "한 번에 다 보정" 의도였으나 grep 검증 절차가 박혀 있지 않아 일부 누락 발생. 결정 4 의 grep 절차 박음으로 회피.
- Lighthouse audit 가 mobile viewport 외 영역 (`hidden md:flex`) 을 검출하지 못하는 한계 — 자동 측정만 신뢰하면 잔존 누락. grep + audit 두 layer 병행 필수.
- stone-400 contrast 7.72:1 은 WCAG AA (4.5:1) + AAA (7:1) 모두 통과. 보조 텍스트 톤으로 충분.

### Claude Code 가 모르는 것

- 시각 디자인 의도상 stone-500 의 "조용한 보조" 톤이 stone-400 으로 대체 가능한지 LEE 의 시각 검증 필요 (페이즈 2-B-5 의 baseline 갱신 시점).
- 페이지 외 영역 (atoms / 사이드 패널 / 어드민 등) 의 stone-500 잔존 분포 — 본 ADR 적용 범위는 랜딩 (페이즈 2-B) 범위, 다른 영역은 페이즈 3+ 점검.
