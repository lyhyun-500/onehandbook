# Pre-Phase 1 Baseline (2026-05-09)

> 디자인 페이즈 1 진입 직전 측정. 페이즈 5 종료 후 비교 기준.

---

## 측정 환경

- 측정 일시: 2026-05-09 17:29 KST
- 측정 도구: Lighthouse 13.0.2 (Chromium 147.0.0.0)
- 측정 페이지: https://novelagent.kr/ (랜딩)
- 디바이스: Emulated Moto G Power (Mobile)
- 네트워크: Slow 4G throttling
- 세션: Initial page load (single page session)

---

## Lighthouse 점수

| 항목 | 점수 | 임계값 |
|---|---|---|
| Performance | **80** | 🟡 50-89 |
| Accessibility | 100 | 🟢 90-100 |
| Best Practices | 96 | 🟢 90-100 |
| SEO | 100 | 🟢 90-100 |

---

## Core Web Vitals

| 메트릭 | 값 | 권장 임계값 | 상태 |
|---|---|---|---|
| First Contentful Paint (FCP) | 2.9s | < 1.8s | 🔴 |
| **Largest Contentful Paint (LCP)** | **3.9s** | **< 2.5s** | 🔴 **(최대 약점)** |
| Total Blocking Time (TBT) | 190ms | < 200ms | 🟢 |
| Cumulative Layout Shift (CLS) | 0 | < 0.1 | 🟢 (완벽) |
| Speed Index | 2.9s | < 3.4s | 🟢 |

---

## Lighthouse Insights (자동 진단)

| 항목 | 절감 가능 | 우선순위 |
|---|---|---|
| Render-blocking requests | **700ms** | 🔴 최우선 |
| Reduce unused JavaScript | 152 KiB | 🔴 |
| Minimize main-thread work | 2.5s | 🔴 |
| Reduce unused CSS | 24 KiB | 🟡 |
| Legacy JavaScript | 13 KiB | 🟡 |
| Improve image delivery | 13 KiB | 🟡 |

---

## E2E 회귀 슈트

- 통과 여부: ✅ (사전 확인됨)
- 실행 시간: 1.7~1.9m
- 명령: `npm run test:e2e:regression`

---

## 페이즈 1 진입 시 시사점

### 🚨 LCP 3.9s가 최대 약점

- Newsreader serif 폰트 도입 시 LCP 더 악화 위험
- 따라서 페이즈 1에서는 **`--font-serif` 토큰 선언만** 진행, **실 적용은 페이즈 2 랜딩 작업 시점에 LCP A/B 측정 후 결정**

### Render-blocking 700ms 절감

- 페이즈 1에 "Render-blocking 절감" 1 commit 추가 결정
- 시간 박스: 분석 + 1차 개선 최대 4시간
- root cause 후보: next/font 사용 여부, 외부 스크립트, CSS import 순서, font-display 설정

---

## 페이즈 5 종료 후 비교 목표

| 항목 | Baseline | 페이즈 5 목표 |
|---|---|---|
| Performance | 80 | **90+** |
| LCP | 3.9s | **< 2.5s** |
| FCP | 2.9s | < 1.8s |
| TBT | 190ms | 유지 (< 200ms) |
| CLS | 0 | 유지 |

---

## 부록 — Lighthouse 점수 산정 가중치 참고

Performance 점수 = FCP 10% + Speed Index 10% + LCP 25% + TBT 30% + CLS 25%

→ TBT/CLS는 이미 최상. **LCP 개선이 점수 상승에 가장 효율적** (가중치 25%).
