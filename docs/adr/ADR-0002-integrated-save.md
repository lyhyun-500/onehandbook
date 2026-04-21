# ADR-0002: 통합 저장 방식 — 상위 조율(Promise.allSettled) 채택

**Status**: Proposed (v2 — 코드베이스 검토 반영)
**Date**: 2026-04-21
**Author**: LEE
**Reviewer**: Cursor (코드베이스 정합성 검토)
**Context**: Novel Agent / Day 6 사이드 패널 통합 저장 설계
**Related**: ADR-0001 (NAT 토큰 모델 우선)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-21 오후 | 초안 (Promise.all 기반) |
| **v2** | **2026-04-21 저녁** | **코드 정합성 검토 반영: Promise.all → Promise.allSettled, 트랜잭션 표현 정정, 메모 flush 정책 명시, 조율자 위치 후보 명시** |

---

## 1. Context (배경)

### 문제
Day 5 에 사이드 패널을 구현하면서 저장 방식이 3갈래로 나뉘었다.

| 영역 | 테이블 | 저장 방식 | 트리거 |
|------|--------|---------|--------|
| 회차 본문 | `episodes` | 폼 제출 | 본문 저장 버튼 |
| 세계관/인물 | `works` (jsonb) | 사이드 패널 저장 | 사이드 패널 전체 저장 버튼 |
| 메모 | `episode_memos` | 자동저장 (디바운싱) | 타이핑 후 1초 |

사용자 시각에서 **"저장"** 버튼이 2개, 자동저장 1개. 회차 편집 중 본문만 수정해도 사이드 패널 dirty 배지가 그대로 남는 등 일관성 부족.

### 요구사항
- 회차 편집 페이지에서 **단일 "저장" 액션**으로 본문 + 세계관 + 인물 + 메모 전부 반영
- 부분 실패 시 사용자에게 **부위별 명확한 피드백** (본문 OK / 세계관 실패 등)
- 메모 자동저장과 충돌 없어야 함
- 기존 `EpisodeEditForm` 코드 최소 침습

### 제약
- 베타 단계, 사용자 수 적음 (실험 여지 있음)
- 1인 운영, 복잡도 감당 가능 범위
- Vercel 서버리스, 단일 요청 300초 제한
- 이직 포트폴리오 자산으로 가치 있어야 함
- DB 트랜잭션 불가 (`episodes` 와 `works` 는 별도 업데이트, Supabase RPC 미사용)

---

## 2. Decision (결정)

**옵션 B — 상위 조율 방식 (`Promise.allSettled`) 을 채택한다.**

### 설계
1. 회차 편집 페이지가 **본문 저장 핸들러** + **사이드 패널 저장 핸들러** 를 각각 ref 로 보유
2. 통합 저장 버튼 클릭 시 `Promise.allSettled([saveContent(), savePanel()])` 호출
3. 결과 배열을 순회하여 각 부위 성공/실패 집계 후 사용자에게 표시
4. 메모 자동저장은 **그대로 유지**, 단 통합 저장 클릭 시점에 **pending 디바운싱 flush 처리** (정책 b 채택, 아래 4.3 참고)
5. 성공한 부위만 dirty 플래그 초기화

### 구현 방침
- `useImperativeHandle` 로 자식 컴포넌트의 `save()` 메서드 노출
- 각 `save()` 는 `{ success: boolean, error?: string }` 반환
- 부모(조율자)가 결과 집계 + UI 피드백 책임
- 어느 컴포넌트가 조율자인지는 **§5 에서 결정 후보 명시**

---

## 3. Alternatives Considered (다른 후보들)

### 옵션 A: 이벤트 버스 방식
- 본문 저장 시 `episode:save` 이벤트 발행 → 사이드 패널 구독해서 자기 것도 저장
- 장점: 컴포넌트 간 느슨한 결합
- 단점: **성공/실패 동기화 어려움**. 한쪽 실패를 다른 쪽이 모름

### 옵션 C: 분리 유지 + UI 통일
- 저장 로직은 각자 유지, "모두 저장" 버튼이 순차 호출
- 장점: 구현 가장 빠름 (1~2시간)
- 단점: **"통합 저장"이라 하고 사실상 개별 저장**. 반쪽짜리

---

## 4. ⚠️ 중요 정정 (v2 추가)

### 4.1 "트랜잭션" 표현 정정

v1 에서 "트랜잭션처럼 동작" 이라 표현했으나 **부정확**.

| 구분 | 실제 동작 |
|-----|---------|
| **DB 트랜잭션** | 하나 실패 = 전체 롤백 (DB 레벨 보장) |
| **Promise.allSettled** | 각각 독립 실행, 부분 성공 가능 |

→ 본 ADR 에서 채택한 방식은 **"DB 트랜잭션"이 아니라 "트랜잭션적 UX"** 임.
- 데이터 레벨에서는 부분 저장 가능 (예: 본문 OK, 세계관 실패)
- UX 레벨에서 사용자에게 **부위별 명확한 피드백** 으로 보완
- 진정한 원자성 필요 시 Supabase RPC (PL/pgSQL 함수) 도입 필요 → 본 결정 범위 외

### 4.2 `Promise.all` → `Promise.allSettled` 변경

v1 에서 `Promise.all` 명시했으나 부분 실패 UX 처리에 부적합:

```typescript
// ❌ Promise.all — 첫 실패에서 전체 reject, 나머지 결과 손실
try {
  await Promise.all([saveContent(), savePanel()]);
} catch (err) {
  // 어느 게 실패했는지 불명확
}

// ✅ Promise.allSettled — 모두 끝까지 실행, 결과 집계 가능
const results = await Promise.allSettled([saveContent(), savePanel()]);
const failures = results
  .map((r, i) => ({ part: ['content', 'panel'][i], result: r }))
  .filter(({ result }) => result.status === 'rejected');

if (failures.length > 0) {
  // 어느 부위 실패했는지 명확히 사용자에게 표시
}
```

### 4.3 메모 자동저장 처리 정책 결정

v1 의 Open Question 이었던 부분에 결정 추가:

**채택**: **옵션 b — 통합 저장 클릭 시 메모 flush**

| 옵션 | 설명 | 채택 여부 |
|-----|------|--------|
| a. 무시 | 메모는 자동저장이라 통합 저장과 무관 처리 | ❌ |
| **b. flush** | **통합 저장 클릭 시 메모 디바운싱 무시하고 즉시 저장** | **✅** |
| c. dirty 표시 | 메모 pending 상태를 통합 저장 버튼에 반영 | ❌ |

**채택 근거**:
- 옵션 a: 사용자가 "전체 저장" 눌렀는데 1초 디바운싱 때문에 메모만 따로 저장되는 게 직관에 어긋남
- 옵션 b: 통합 저장 시점에 메모도 확정 → 사용자 의도와 일치
- 옵션 c: dirty 상태 추가 관리 = 복잡도 증가, 효익 적음

**구현**: `MemoTab` 에 `flushPendingSave()` 메서드 노출, 통합 저장 시 호출.

---

## 5. 조율자 위치 결정 (v2 추가)

Cursor 검토 결과, 조율자 후보 3곳 비교:

| 위치 | 장점 | 단점 | diff 크기 |
|-----|-----|-----|---------|
| `EpisodeEditPage` | 페이지 레벨, 가장 자연스러운 조율 위치 | 페이지 컴포넌트 비대화 | 중 |
| `EpisodeEditForm` | 본문 저장 로직 이미 보유 | 본문 컴포넌트가 사이드 패널까지 알게 됨 (관심사 혼재) | 작음 |
| `SidePanelWrapper` | 사이드 패널 통제 가능 | 본문 저장은 ref 로 외부 호출 필요 (역방향) | 큼 |

**채택**: **`EpisodeEditPage` (페이지 레벨 조율)**

**근거**:
- 본문/사이드 패널/메모 모두 **페이지의 자식 관계** → 자연스러운 조율자
- `EpisodeEditForm` 의 저장 함수만 외부로 노출 (`useImperativeHandle`) = 최소 침습
- 향후 다른 영역 (예: 회차별 태그) 추가 시 동일 패턴 확장 가능

---

## 6. EV Analysis (기댓값 분석, v1 유지)

> 공식: **E = P(win) × Gain − P(loss) × Loss**

### 옵션 A — 이벤트 버스
```
P(win)   = 0.5  (동작 자체는 함, 동기화 문제 잠재)
Gain     = 구현 속도 (반나절) + 이벤트 패턴 학습
P(loss)  = 0.5
Loss     = 부분 실패 시 신뢰 하락, 버그 대응, 재설계
EV       ≈ 0 ~ 살짝 음수
```

### 옵션 B — 상위 조율 ⭐ 채택
```
P(win)   = 0.85 (Promise.allSettled + 부위별 집계로 명확 처리)
Gain     = 안정적 UX
         + 트랜잭션적 UX 설계 경험 (면접/포폴 +3)
         + 다른 기능에 재사용 가능한 패턴
P(loss)  = 0.15
Loss     = 2~3시간 추가 작업, 기존 컴포넌트 리팩터링 부담
EV       ≈ 강한 양수
```

### 옵션 C — 분리 + UI 통일
```
P(win)   = 0.7  (구현 안정, 단 "통합" 은 아님)
Gain     = 시간 절약 (1~2시간)
P(loss)  = 0.3  (재작업 확률)
Loss     = 향후 진짜 통합으로 전환 시 재작업, "타협 코드" 흔적
EV       ≈ 약한 양수, Gain 무형 가치 빈약
```

### 비교

| 옵션 | EV | P(win) | 샤프 비율 |
|-----|----|--------|---------|
| A | ≈ 0 | 0.5 | 낮음 |
| **B** | **강한 양수** | **0.85** | **최고** |
| C | 약한 양수 | 0.7 | 중간 |

---

## 7. Consequences (결과 예상)

### Positive
- 단일 저장 버튼으로 UX 일관성 확보
- 부위별 실패 피드백으로 사용자 신뢰 유지
- 부모-자식 조율 패턴이 이후 다른 기능 (일괄 분석 UI 등) 에 재사용 가능
- **포트폴리오 가치**: "트랜잭션적 UX 설계" + "Promise.allSettled 패턴" 사례 확보

### Negative
- `EpisodeEditPage` 에 조율 로직 추가로 복잡도 상승
- 자식 컴포넌트들 (사이드 패널, 본문 폼, 메모) 가 부모에 일부 결합됨
- `useImperativeHandle` 패턴 학습 필요
- DB 레벨 원자성 미보장 (부분 저장 가능, UX 로 보완)

### Neutral
- 메모 자동저장 자체는 그대로 분리 유지, 통합 저장 시점에만 flush

---

## 8. Implementation Plan (Day 6, 4 Phase)

### Phase 1. 자식 메서드 노출 (1.5시간)
- `SidePanelWrapper` 또는 내부 컴포넌트에 `useImperativeHandle` 로 `save()` 노출
- `MemoTab` 에 `flushPendingSave()` 노출
- `EpisodeEditForm` 에 `submit()` 또는 `save()` 노출 (기존 폼 제출 로직 추출)
- 각 `save()` 반환값: `{ success: boolean, error?: string }`

### Phase 2. 부모 조율자 구현 (1.5시간)
- `EpisodeEditPage` 에 3개 ref 보유 (form / panel / memo)
- 통합 저장 핸들러:
  ```typescript
  async function handleIntegratedSave() {
    // 1. 메모 flush (자동저장 pending 즉시 처리)
    await memoRef.current?.flushPendingSave();

    // 2. 본문 + 사이드 패널 병렬 저장
    const results = await Promise.allSettled([
      formRef.current?.save(),
      panelRef.current?.save(),
    ]);

    // 3. 결과 집계 + 부위별 피드백
    const status = aggregateResults(results);
    showFeedback(status);
  }
  ```

### Phase 3. UI/피드백 (1시간)
- 저장 버튼 상태 (clean / dirty / saving / partial-error / error)
- 부분 실패 시 부위별 표시 ("본문 저장됨, 세계관 저장 실패")
- 성공한 부위만 dirty 초기화
- 토스트 또는 인라인 메시지

### Phase 4. 검증 (30분)
- 본문만 수정 → 저장 성공
- 사이드 패널만 수정 → 저장 성공
- 동시 수정 → 저장 성공
- 네트워크 강제 실패 → 부위별 실패 메시지
- 메모 디바운싱 중 통합 저장 클릭 → flush 동작
- 메모 자동저장 단독 동작 여전히 정상

---

## 9. Open Questions (남은 미해결 사항)

- 저장 중 네트워크 끊김 시 재시도 정책 (현재 범위 외, 사용자 수동 재시도)
- 세계관 jsonb 업데이트는 `works` 테이블 전체 갱신 vs 부분 업데이트 (현재 전체 갱신 유지)
- 부분 실패 시 자동 재시도 가능 여부 (실패한 부위만 다시 시도)
- Phase 2 의 한줄설명/역할 5옵션 변경이 통합 저장 payload 에 미치는 영향 (스키마 확장)

---

## 10. Revisit Criteria

아래 조건에서 이 결정을 재검토한다:
- 저장 플로우가 3개 초과 확장되는 경우 (이벤트 버스 재고려)
- 사용자 규모 확대로 Promise.allSettled 응답 지연 문제 발생 시
- 진정한 DB 트랜잭션 필요 (예: 결제 연동) → Supabase RPC 도입
- 오프라인 편집 기능 요구 시 (로컬 first + 동기화 재설계 필요)

---

## Appendix A: EV 사고 방법론

이 ADR 은 **"퀀트적 사고 — 모든 의사결정은 기댓값 게임"** 프레임을 처음 적용한 사례다.
감과 EV 가 모두 옵션 B 를 지목했다. 감의 신뢰도 한 번 검증된 셈.

추후 중대 결정에서도 동일 포맷으로 기록 예정.
- ADR-0003 (예정): 관리자 페이지 MVP 범위
- ADR-0004 (예정): 패들 결제 오픈 시점
- ADR-0005 (예정): 파인튜닝 시작 판단

## Appendix B: v2 업데이트 회고

v1 작성 직후 Cursor (코드 자동 분석 도구) 가 다음 3가지를 지적:
1. `Promise.all` 의 부분 실패 처리 한계
2. "트랜잭션" 표현의 부정확성
3. 메모 flush 정책 명시 필요

→ 즉시 v2 로 반영. **"피드백 받고 24시간 내 수정"** 패턴 정착.
ADR 의 가치는 결정 자체가 아니라 **결정의 진화 과정** 을 남기는 데 있음.

---

**End of ADR-0002 v2.**

