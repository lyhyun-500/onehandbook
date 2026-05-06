# ADR-0012: 일괄(통합) 분석에서 `runBundled` 제거

- **Status**: Accepted
- **Date**: 2026-05-03
- **Related**: [TS-001](../troubleshooting/TS-001-self-ddos-runbundled-incident.md)

---

## Context

### 도입 경위
- `runBundled`(`runBundledEpisodesForHolisticSelection`)는 2026-04-12 commit `f3da440`에 도입됨
- 의도: 일괄 분석에서도 회차별 심도 있는 결과를 보장하기 위해 회차마다 LLM을 추가 호출

### 도입 후 발견된 문제
- 5화 일괄 분석 = LLM 6회 호출 (회차 5 + 통합 1)
- 처리 시간 약 7분 17초 → Vercel maxDuration 5분 초과로 timeout
- chunk 경로(10화 단위 배치)는 단일 호출인데 single_call 경로만 비대칭
- `analysis_runs` 테이블에 같은 `episode_id` 기준 중복 18건 누적 (bundled + holistic_derived)

### 스키마 변화로 본래 목적 충족 가능
- 2026-04-19 commit `a854577`에서 LLM 응답 스키마에 `episode_scores[]` 확장
- `episode_scores[]`로부터 `dimensions`, `improvements`, `comment` 모두 derive 가능
- `syncPerEpisodeAnalysisFromHolisticRun`이 통합 결과에서 회차별 데이터를 derive하는 경로 이미 존재

### Mismatch 문제
- commit `5ccc749`의 메시지는 "runBundled 제거 상태 유지" 의도였으나
- 실제 코드는 `runBundled` 호출이 살아있는 상태로 머지됨
- 명문화된 결정 없이 코드만 회귀해온 상황 → ADR로 결정 박제 필요

---

## Decision

### 제품 정의 명확화
- **일괄 분석** = 작품 전체 흐름 + 회차별 점수 overview
- **회차별 심도 분석** = 개별 분석(episode) 기능
- 두 기능의 책임 경계를 분리하고, 일괄 분석에서 회차 fidelity는 derive로 충분히 제공

### 코드 변경
1. `runBundledEpisodesForHolisticSelection` 호출 제거
2. `runEpisodeAnalysisBundledInHolistic.ts` 파일 삭제
3. 회차별 데이터는 `syncPerEpisodeAnalysisFromHolisticRun`의 derive 경로로 일원화
4. 기존 chunk 경로와 single_call 경로의 LLM 호출 횟수를 일치시킴 (대칭성 회복)

---

## Alternatives Considered

### 옵션 A — runBundled 유지 (현 상태)
- 회차별 LLM 추가 호출로 fidelity 보장
- 비용: LLM 6배, 처리 시간 7배, maxDuration 초과 → 사실상 사용 불가
- 거부 근거: TS-001 사고의 직접 원인. 작동하지 않는 fidelity는 가치 없음.

### 옵션 B — runBundled 제거 + derive로 전환 ⭐ 채택
- `episode_scores[]` 스키마(4/19 추가)로 회차별 데이터 derive 가능
- LLM 1회로 통합 결과 + 회차별 overview 동시 생성
- 트레이드오프: 회차별 fidelity 단독 LLM 대비 약화 가능 → 사용자 가이드로 mitigate

### 옵션 C — runBundled 유지 + chunk 경로에도 적용 (대칭성 회복)
- single_call뿐 아니라 chunk 경로에서도 회차별 LLM 추가 호출
- 두 경로 동작 일치 + 회차별 fidelity 양쪽 다 강함
- 거부 근거: 비용 폭증 (10화 chunk × N개 = LLM 호출 산술 폭발). NAT 단가 산정 모델 자체가 흔들림. 옵션 A의 본질적 문제(처리 시간/maxDuration)를 chunk 경로에도 전파하는 꼴.

### 옵션 D — runBundled 제거 + 회차별 단독 LLM 비동기 백필
- 일괄 분석 즉시 결과는 derive로, 회차별 fidelity는 백그라운드 worker가 사후 채움
- 거부 근거: 시스템 복잡도 증가 (worker, 상태 관리, partial result UI). 현재 사용자 피드백상 derive 품질이 "낫뱃"으로 충분 → 과한 투자.

---

## Revisit Criteria

다음 신호가 누적되면 ADR-0012 재검토:

1. **회차별 fidelity 사용자 불만 ≥ 5건/주** (현재 0건)
   - "회차별 점수가 너무 단조롭다", "improvements가 일반적이다" 등
2. **derive vs 단독 LLM 정확도 차이가 측정 가능 수준으로 벌어짐**
   - 향후 평가 지표 도입 시 derive 결과가 hallucination/누락이 잦아질 경우
3. **Vercel maxDuration 한계 완화** (현재 5분 → 10분 이상)
   - 기술 제약이 풀리면 옵션 D(비동기 백필) 부담이 낮아짐
4. **LLM 단가 50% 이상 하락** + **사용자 NAT 가격 인상 가능한 시장 환경**
   - 옵션 C(대칭성)의 비용 부담이 수용 가능 수준으로 떨어질 때

재검토 시 이 ADR을 v2로 업데이트, 폐기 시 superseded 표시 후 신규 ADR 생성.

---

## Consequences

### 긍정
- LLM 호출 6회 → 1회 (호출 수 83% 감소)
- 처리 시간 7배 단축 (7분+ → 1~2분)
- `analysis_runs` 중복 적재 제거
- chunk 경로와 single_call 경로 동작 일관성 확보
- Vercel maxDuration 한계 안에서 안정 동작
- NAT 소비-가치 비율 개선 (사용자 비용은 동일, 결과는 더 빠름)

### 영향
- 회차별 fidelity가 단독 LLM 호출 대비 약화될 가능성 존재
- mitigation: 사용자 가이드에 "회차별 심도는 개별 분석에서 확인" 안내
- mitigation: 일괄 분석은 작품 흐름 + overview에 가치 있음을 UI에서 명시

### 회귀 방지
- chunk vs single_call 경로 동등성을 회귀 테스트로 보장 (TS-001 후속)
- 향후 `runBundled` 류 코드 재도입 시 ADR 갱신 필수

---

## Validation

### 데이터 검증
- bundled 결과 vs derive 결과 비교 (LEE 직접 샘플 확인 → "낫뱃" 판정)
- 회차별 점수, dimensions, improvements 모두 정상 표시 확인

### 성능 검증
- 5화 처리 속도: 7분+ (timeout) → 1~2분 (정상)
- 분석 1건당 쿼리: 약 1,500 → 약 400 (74% 감소, RC#2 처방과 합산)

### UX 검증
- 회차별 결과가 일괄 분석 결과 페이지에 정상 렌더링
- 사용자 인지 가능한 품질 저하 보고 0건 (D+1 ~ D+3)

---

## Notes

ADR-0012는 사고 직후 작성되어 결정의 사후 명문화 성격이 강하다. 그러나 mismatch 사례(`5ccc749`)에서 보았듯, **결정이 코드에만 있고 문서에 없으면 회귀한다.** 이 ADR의 진짜 가치는 향후 누군가 "회차별 fidelity가 약하니 다시 LLM 호출하자"고 제안할 때 ADR-0012가 reject 근거가 되는 것에 있다.
