# ADR-0026: Lighthouse 측정 환경 통제 정책

- **Status**: Accepted
- **Date**: 2026-05-11 (페이즈 2-B-4.5)
- **Related**:
  - ADR-0023 (Noto_Sans_KR 제거) — 페이즈 1 최초 Performance 개선 (80 → 97).
  - ADR-0024 (컴포넌트 아키텍처) — 페이지 마이그레이션 시 Lighthouse audit 가 안전망.
  - ADR-0025 (Visual baseline) — 시각 회귀와 별개로 정량 회귀 측정 layer.
  - 페이즈 2-B-4 mid-phase 측정 + 2-B-4.5 outlier 발견 — 본 ADR 의 적용 사례.

---

## Context

### 발견 경위

페이즈 2-B-4 (page.tsx 마이그레이션) 진행 중 mid-phase Lighthouse 측정에서 환경 차이 가설을 세웠고, 페이즈 2-B-4.5 (Accessibility 보정) 직후 재측정에서 단발 outlier 가 발생하면서 측정 신뢰성 문제가 표면화.

#### 측정 이력 (페이즈 2-B 누적)

| 시점 | 환경 | Performance | LCP | TBT |
|---|---|---|---|---|
| 페이즈 1 끝 | Vercel production (DevTools 13.0.2) | 97 | 2.6s | — |
| 페이즈 1 끝 | localhost prod preview (DevTools 13.0.2) | 87 | 4.1s | — |
| 페이즈 2-B-4 mid | localhost prod preview (DevTools 13.0.2) | 92 | 3.3s | — |
| 페이즈 2-B-4.5 직후 | localhost prod preview (DevTools 13.0.2) | **68** | — | **3,450ms** |
| 페이즈 2-B-4.5 재측정 #1 | localhost prod preview (CLI 13.3.0) | 90 | 3.5s | 92ms |
| 페이즈 2-B-4.5 재측정 #2 | localhost prod preview (CLI 13.3.0) | 92 | 3.3s | 85ms |
| 페이즈 2-B-4.5 재측정 #3 | localhost prod preview (CLI 13.3.0) | 92 | 3.3s | 84ms |
| 페이즈 2-B-4.5 Vercel | Vercel production (CLI 13.3.0) | 90 | 3.4s | 103ms |

### 문제 정의

1. **단발 측정의 신뢰성 부재** — 페이즈 2-B-4.5 직후 단발 측정이 Performance 68 / TBT 3,450ms 로 폭락. 보정 작업은 색상 토큰 교체뿐이라 Performance 회귀 유발 가능성 0. 동일 코드 / 동일 환경 (CLI) 에서 3회 측정 시 90~92 / TBT 84~92ms 로 안정 — 단발 outlier 확인.
2. **환경 차이 가정의 과잉 추정** — 핸드오프 문서가 "localhost = Vercel - 1.5s LCP" 가정을 박았으나, CLI 13.3.0 으로 동일 도구 측정 시 localhost 평균 (LCP 3.4s) 와 Vercel (LCP 3.4s) 가 거의 동일. 환경 차이 (CDN / brotli / edge) 가 LCP 1.5s 만큼 크지 않음.
3. **측정 도구 차이의 잠재 변동** — DevTools 13.0.2 와 CLI 13.3.0 의 점수 차이가 7점 (Vercel 97 vs 90) 발생. minor version 차이 + scoring rubric 갱신 + Headless Chrome 환경 차이가 누적 영향.
4. **베이스라인 기준 모호** — 핸드오프 문서가 페이즈마다 다른 환경/도구로 측정한 값을 직접 비교 → 회귀 vs 환경 효과 진단 불가.

---

## Decision

### 결정 1 — 측정 단위: 단발 금지, 3회 평균 표준

- 단발 측정은 outlier 가능성 제거 불가 — 환경 변수 (백그라운드 프로세스 / thermal / 캐시 상태) 가 단일 측정에 큰 변동 유발.
- 페이즈 분기 결정 / 회귀 진단에 사용하는 측정값은 **3회 연속 측정의 평균** 사용.
- 3회 측정값 표준편차가 큰 경우 (Performance 5점 이상 / LCP 0.5s 이상) outlier 1건 제외 + 추가 측정으로 확정.

### 결정 2 — 동일 도구 / 동일 환경 통제

페이즈 간 비교 측정 시 도구와 환경을 한 쌍으로 고정:

| 측정 목적 | 도구 | 환경 | 비고 |
|---|---|---|---|
| 페이즈 분기 결정 | CLI 13.3.0 (또는 동급) | localhost prod preview | 자동화 가능, 헤드리스, 재현성 ↑ |
| 페이즈 종료 베이스라인 | CLI 13.3.0 또는 DevTools 13.0.2 | Vercel production | 사용자 실측 환경, 분기마다 같은 도구 사용 |
| 디버깅 audit (failing element 식별) | DevTools 13.0.2 또는 CLI JSON 파싱 | 어느 환경이든 | 점수가 아니라 audit detail 이 목적 |

- 절대값 직접 비교 시 동일 도구 + 동일 환경 강제. 도구가 다르면 절대값 비교 금지.
- 3회 평균이 박힌 측정은 도구/환경 라벨과 함께 기록 (예: "Performance 91 (CLI 13.3.0 / localhost 평균 3회)").

### 결정 3 — 환경 통제 체크리스트 (단발 측정 시점)

단발 outlier 방지를 위한 사전 통제:

1. 다른 무거운 앱 종료 (브라우저 탭 / 빌드 프로세스 / Docker 컨테이너 / Slack 등).
2. macOS thermal 안정 상태 확인 (`pmset -g therm` 또는 fan idle).
3. localhost 측정 시 production server 단독 기동 (dev server 동시 기동 금지).
4. CLI 사용 시 `--chrome-flags="--headless=new --no-sandbox"` 명시.
5. 시크릿 모드 + 확장 비활성 (DevTools 사용 시).

체크리스트 누락 시 단발값을 분기 결정 근거로 사용 금지 → 결정 1 의 3회 평균 적용.

### 결정 4 — 환경 차이 가정 폐기

- 페이즈 1 의 "Vercel 97 / localhost 87" 측정 차이 (10점) 는 측정 도구 동일 + 단발 측정 → 환경 효과로 결론 박힘.
- CLI 13.3.0 동일 도구로 동시 측정 시 localhost (90) ≈ Vercel (90) → "localhost = Vercel - 1.5s LCP" 가정 부정확.
- 향후 측정에서 환경 차이를 정량 가정으로 사용 금지 — 동일 도구로 양 환경 동시 측정 후 그 시점의 차이만 사용.

### 결정 5 — 6:02 PM outlier 함정 박제

페이즈 2-B-4.5 직후 단발 측정값:

| 항목 | outlier 값 | 정상 평균 (3회) | 비율 |
|---|---|---|---|
| Performance | 68 | 91 | -23점 |
| TBT | 3,450ms | 87ms | x40 |

**outlier 추정 원인** (LEE 환경):
- 백그라운드 프로세스 CPU 점유 (TBT x40 패턴은 CPU 경합 시그널).
- macOS thermal throttling (M1 다운클럭).
- Chrome 확장 (시크릿 모드 일부 활성).

**교훈**: TBT 정상 범위 (50~150ms) 의 10배 이상 outlier 는 환경 변수로 추정하고 재측정 절차 진입. 코드 회귀 가설로 즉시 진단 시작 금지.

### 결정 6 — 페이즈 종료 베이스라인 기록 표준

각 페이즈 종료 시 다음 형식으로 기록 (commit message 또는 ADR):

```
페이즈 X 끝 베이스라인 (CLI 13.3.0 / localhost prod preview / 3회 평균):
  Performance 92 / a11y 100 / LCP 3.3s / TBT 87ms / FCP 0.9s
페이즈 X 끝 Vercel 측정 (CLI 13.3.0 / production):
  Performance 90 / a11y 100 / LCP 3.4s / TBT 103ms / FCP 1.5s
```

도구/환경 라벨과 측정 회차 (단발 / 3회 평균) 명시 의무.

---

## Alternatives Considered

### 옵션 A — 측정 단위
- **A1. 3회 평균 (채택 ⭐)**: outlier 흡수, 신뢰성 ↑.
- **A2. 단발 측정**: 빠르나 환경 변수 노출 — 페이즈 2-B-4.5 outlier 사례로 부적합 확인.
- **A3. 5회 평균**: 신뢰성 더 ↑, 시간 비용 1.6배. 3회로 충분 (표준편차 작음).

### 옵션 B — 베이스라인 환경
- **B1. localhost prod preview + Vercel 병기 (채택 ⭐)**: 자동화 가능 + 사용자 실측 동시 확인.
- **B2. Vercel production 단독**: 사용자 실측에 가장 가까우나 측정마다 배포 필요 → 페이즈 진행 중 사용 어려움.
- **B3. localhost 단독**: 자동화 쉬우나 사용자 실측과 괴리.

### 옵션 C — 도구
- **C1. CLI 13.3.0 (채택 ⭐, 페이즈 진행 측정용)**: 자동화, 재현성, JSON detail 추출 가능.
- **C2. DevTools 13.0.2 (베이스라인 보조)**: 사용자 친숙, audit UI 직관적. 자동화 부적합.
- **C3. PageSpeed Insights API**: 외부 의존, rate limit. 후순위.

---

## Tradeoffs

받아들인 부담:
- 측정 시간 3배 증가 (단발 → 3회) — 페이즈 분기 결정 시점에만 적용하여 일상 측정 부담 제어.
- CLI 13.3.0 vs DevTools 13.0.2 점수 차이 (~7점) — 도구 라벨 박아 절대값 직접 비교 회피.

받지 않은 부담:
- 측정 자동화 시스템 구축 (CI 통합) — 페이즈 종료 시점 수동 측정으로 충분, 자동화는 페이즈 5 이후 검토.
- 도구 강제 통일 (CLI 단독) — DevTools 가 audit detail 확인에 여전히 유용, 두 도구 병행 허용.

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- **자동화 필요성 증가** — 페이즈 5+ 또는 production 회귀 모니터링 도입 시 CI Lighthouse 자동 측정 도입 검토 (별도 ADR).
- **CLI / DevTools 점수 차이가 15점 이상** 으로 벌어질 경우 — 도구 한 종 강제 + 다른 도구 폐기 검토.
- **측정 환경 외부 변수 추가** (예: CDN 변경 / Vercel region 이전) — 베이스라인 재측정 + ADR 갱신.

---

## Consequences

### 긍정
- 페이즈 분기 결정의 정량 근거 신뢰성 ↑ (단발 outlier 차단).
- 환경/도구 라벨 강제로 절대값 비교 함정 회피.
- 페이즈 종료 베이스라인 표준 형식 박혀 페이즈 간 회귀 진단 명확.

### 영향
- **페이즈 2-B-5 이후** 모든 측정에 본 정책 적용 — 측정 시 도구/환경/회차 라벨 명시.
- **페이즈 종료 commit message** 에 베이스라인 표 포함 (결정 6 형식).
- **회귀 진단 시 단발 outlier 가설 우선 검토** — 코드 변경이 측정값 변동 폭과 일치하지 않으면 환경 변수 의심.

---

## Related Commits

- 페이즈 2-B-4.5 (이 ADR 박는 commit) — outlier 사례 발견 + 정책 박제.
- 페이즈 1 끝 (`v-phase-1-end`) — 페이즈 1 베이스라인 측정 (DevTools 단발).
- 페이즈 2-B-4 (`801cda8`) — page.tsx 마이그레이션 mid-phase 측정.

---

## Notes

### Claude Code 가 관찰한 것

- 페이즈 2-B-4.5 의 단발 outlier (Perf 68 / TBT 3,450ms) 는 동일 도구 + 동일 환경 3회 재측정으로 즉시 환경 변수로 분류 가능. 단발 측정은 진단 비용이 큼 (코드 회귀 가설로 빠질 위험).
- DevTools 와 CLI 의 점수 차이는 minor version + Headless Chrome 차이의 누적. 동일 도구 내에서는 측정값 안정.
- 환경 차이 (localhost vs Vercel) 가정은 도구를 통일하면 거의 사라짐 — 핸드오프 문서가 추정한 "1.5s LCP 차이" 가 실제로는 "0.1s 이내" 였음.

### Claude Code 가 모르는 것

- LEE 의 6:02 PM 환경의 정확한 외부 변수 (어떤 백그라운드 프로세스가 CPU 점유했는지). 추정만 가능.
- DevTools 13.0.2 와 CLI 13.3.0 의 정확한 scoring rubric 차이. minor version changelog 확인 필요 시 검토.
