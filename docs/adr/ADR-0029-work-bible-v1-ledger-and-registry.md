# ADR-0029: 작품 바이블 v1 — fact 원장 + 엔티티 레지스트리

- **Status**: Accepted
- **Date**: 2026-06-08
- **Related**: `7aca0f8` (work_entities + work_facts migration), CLAUDE.md §분석 도메인, ADR-0001 (NAT)

---

## Context

### 발견 경위
- 단일 회차 분석 + 일괄 분석 모두 회차 본문 단독을 LLM 에 던지는 사실. 작가가 작품 설정 (`works.world_setting` / `works.character_settings`) 입력해도 user prompt 안 단순 텍스트 끼우기 수준.
- 결과: 회차 간 인물 일관성 / 복선 회수 / 사건 누적 흐름 = LLM 이 매 호출 새로 추론 = 회차 간 모순 잠재.
- 30화 이상 작품 = 분석 품질 평탄화 진단 (작품 103 LEE 사례 등).

### 문제 정의
- **상태(state) 모델 부재**: 회차 단위 fact 가 누적 영속화 되지 않아 fold (특정 회차 시점까지의 누적 상태) 계산 불가.

---

## Decision

### 결정
작품 바이블 v1 = **fact 원장 (`work_facts`) + 엔티티 레지스트리 (`work_entities`) 분리 모델**. 회차별 추출 패스가 fact 를 append 하고, read 시점에 `episode_number < N` 필터로 fold 계산. 엔티티 레지스트리는 정체성 (canonical_name + aliases + 정적 속성) 만, 가변 상태는 원장만.

핵심 사양 10건:
1. **스냅샷 아닌 원장 (ledger) 모델**: 회차마다 fact append, 회차당 다수 row 가능. 회차별 "최종 상태" snapshot 저장 안 함.
2. **레지스트리 = 정체성, 원장 = 상태**: `work_entities` = canonical_name + aliases + brief + 작가 제공 정적 속성 (`attributes` JSONB). 동적 상태 (성장 / 관계 변동 / 능력 획득) = 전부 `work_facts` 안.
3. **백필 없음**: 분석된 회차의 fact 만 기록. 분석 전 회차 = fact 0 사실. 회귀적 보강 path 부재.
4. **시점 정합**: fold 는 **`episode_number < N` 필터** = N화 분석 시점에 N화 이전 (포함 X) fact 만 사용. 미래 fact 는 채점 미사용 (= leak 차단). N화 자체 fact 는 N화 분석 후행 패스에서 추출.
5. **canon 무판정 원칙**: fact 충돌 발견 시 **정합성 팁** 으로 분석 리포트에 보고만 함. 어느 fact 가 canon 인지 판정 X. 작가가 결정. (= 작가 통제권 우선)
6. **충돌 탐지 3단 구조**:
   - **1단**: 엔티티 ID 스키마 (`entity_ids BIGINT[]` 동일 entity 참조 시 그룹화)
   - **2단**: 결정적 코드 필터 (같은 entity 의 모순 fact_type 조합 — 예: 동일 인물 `state_change` 안 상충 키, foreshadow_planted ↔ resolved 의 entity_ids 불일치 등 코드 룰)
   - **3단**: 조건부 Haiku 판정 (2단 필터 통과한 후보군만 Haiku 에 보내 판정, precision 우선)
7. **fact 추출 = 분석 완료 후행 별도 Haiku 패스**: 본 분석 (단일 회차 / 일괄) 의 파서 계약 (`parse.ts` / `parseHolistic.ts`) **무변경**. 분석 성공 후 별도 Haiku 호출이 회차 본문 + 기존 엔티티 레지스트리 (캐시) 받아 fact 추출 + 신규 엔티티 upsert. NAT 비용 = 본 분석 NAT 에 **번들** (별도 옵션 X, 분석 NAT 안 흡수).
8. **`episode_id ON DELETE CASCADE`**: 삭제된 회차의 fact 보존 시 fold 가 존재하지 않는 회차 사건을 계속 끼움 = 이후 분석 영구 오염. 회차 삭제 = 그 회차 사건 자체가 작품에서 없어졌다는 뜻. 대칭 = 삭제된 회차의 기록도 삭제. 관례 (episodes 참조 = CASCADE 단독) 정합.
9. **쓰기 service_role 전용**: RLS = SELECT only authenticated (1-hop `works.author_id`). INSERT/UPDATE/DELETE 정책 부재 = anon+RLS 우회 path 0. 추출 패스가 server-side `createServiceRoleClient()` (추출 라운드 헬퍼 신설 예정) 단독 path.
10. **재분석 시 fact 하드 교체**: 같은 회차 재분석 = 기존 fact rows 하드 DELETE (`WHERE work_id = ? AND episode_id = ?`) 후 신규 INSERT. 멱등성 보장 + 중복 fact 누적 차단.

### 근거
- **원장 분리**: 스냅샷 모델 (회차마다 전체 상태 dump) = 저장 비용 N×M 폭증 + diff 추적 불가. fact 원장 + read 시 fold = O(N) 저장 + fold 시 O(N) 계산 = 분석 시점만 비용 발생.
- **레지스트리/원장 분리**: canonical_name 정체성 정합 (UNIQUE (work_id, entity_type, canonical_name)) 위해 단일 row entity 필요. 상태 변동은 row append 가 자연.
- **canon 무판정**: 작가가 의도된 모순 (회상·관점 변화 등) 을 갖고 있을 수 있음. AI 가 canon 판정 = 작가 통제권 침해 = LEE 사양 정합 위배. 정합성 팁 보고 = 결정권 작가.
- **3단 탐지**: Haiku 호출 = 비용. 모든 fact 쌍 대조 시 fact 수 제곱 비용. ID 스키마로 candidate 압축 → 코드 결정적 필터 → 남은 ambiguous 만 Haiku.
- **본 분석 파서 무변경**: 본 분석 파서 (한글 6축 + tag_trend_fit) 안정화 통과 사실. 추출 패스 끼우기 = 파서 contract 위반 + 회귀 잠재. 별도 패스 = 독립 변경 path.

---

## Alternatives Considered

### 옵션 A — 스냅샷 모델 (회차당 전체 상태 dump)
- 동작: 회차마다 `work_snapshots` row 1건, 전체 인물·세계관 상태 JSONB.
- 비용: 저장 N × |state| = N 화 작품 안 |state| 가 50KB 면 50MB / 작품 / 분석. 30화+ 작품 다수면 GB 단위.
- 위험: diff 추적 불가, 부분 갱신 불가, 회차 간 변화 query 시 양 snapshot 파싱 후 diff 계산 = 비효율.
- 거부 근거: 저장 비용 + diff 불가 = 분석 시점 fold 계산 비용보다 무거움.

### 옵션 B — fact 원장 + 엔티티 레지스트리 분리 ⭐ 채택
- 본 결정 안 그대로.

### 옵션 C — fact 단일 테이블 (레지스트리 X, entity 이름 = 자유 텍스트)
- 동작: `work_facts` 단독, entity = TEXT (canonical_name 정합 보장 X).
- 비용: 추출 시 같은 인물 "강하늘" / "하늘" / "강사장" alias 매 호출 별도 entity 처리 = 통합 불가.
- 위험: fold 시 같은 인물 fact 가 분산 = 일관성 채점 무력화.
- 거부 근거: alias 통합 + UNIQUE 정체성 보장 = 레지스트리 분리 필수.

### 옵션 D — analysis_results 안 nested JSONB (별도 테이블 X)
- 동작: 기존 `analysis_results.result_json` 안 fact 키 추가.
- 비용: 스키마 변경 0 (JSONB 확장).
- 위험: 회차 간 fact 쿼리 = 매 row JSONB unnest = GIN 인덱스 부재 (분석 결과는 work_id 인덱스 단독) = fold 계산 O(N) full scan + N 화 작품 매 분석 시점 O(N) 비용.
- 거부 근거: query 비용 + 스키마 강제 부재 (free-form JSONB) = 충돌 탐지 코드 필터 구현 불가.

---

## Tradeoffs

받아들인 부담:
- **별도 LLM 호출** = 분석 1건당 LLM 패스 2회 (본 분석 + fact 추출). 추출 Haiku 토큰 비용. NAT 번들 사양 = 작가 노출 비용 변동 0이나 운영 OpEx 증가.
- **회차 삭제 시 fact 영구 손실** (CASCADE). 작가가 회차 삭제 후 다시 등록해도 fact 자동 복원 X = 재분석 필요.
- **canon 무판정 = 충돌 탐지 결과의 결정권 작가** = 분석 리포트 안 "정합성 팁" 노출이 작가에게 추가 인지부하.
- **백필 없음** = 기존 분석 완료된 회차 (본 PR 이전) = fact 0. 작가가 작품 전체 재분석 안 진입 시 fold 무의미. 마케팅 노출 + 작가 진입 비용 의제.
- **재분석 시 fact 하드 교체** = 회차 본문 변경 안 됐는데 단순 재분석만 해도 신규 fact 가 미세 변동 (Haiku temperature 0 라도 prompt 변동 가능). 작가 보존 fact 의제 시 별도 path 필요.

받지 않은 부담:
- **스냅샷 저장 비용 폭증** (옵션 A).
- **본 분석 파서 회귀 리스크** (옵션 D path).
- **alias 분산 (옵션 C)**.
- **fold 계산 O(N) full scan** (옵션 D path).

---

## Revisit Criteria

이 결정을 뒤집을 조건:
- fact 추출 Haiku 비용 / 분석 ≥ 본 분석 비용 의 50% (운영 토큰 측정 후 의제).
- 추출 정확도 (precision) < 70% (작가 피드백 누적 N=30 이후 측정).
- 충돌 탐지 3단 구조 안 1단 (ID 스키마) 매칭률 < 60% (alias 통합 실패 의제).
- fold 계산이 분석 시점 latency 의 20% 초과 (DB 인덱스 + 비정규화 의제 재진입).
- 작가 의도된 모순 vs AI 오탐 비율이 부정적 피드백 누적 N=20 이상 (canon 판정 모델 의제 재검토).

---

## Consequences

### 긍정
- **회차 간 일관성 측정 가능**: fold 가 N-1 화까지 상태 제공 = N화 분석 안 캐릭터 일관성·세계관 고증·복선 회수 채점 정밀화.
- **분석 품질 평탄화 차단**: 30화+ 작품 의제 (LEE 작품 103) 의 잠재 처방.
- **확장성**: fact_type 5종 (event/state_change/relationship_change/foreshadow_planted/foreshadow_resolved) 스키마 개방 = v2 이후 추출 종류 확장 시 schema 변경 없이 추가.
- **데이터 격리**: RLS SELECT only + 쓰기 service_role 단독 = 작가 본인도 fact 직접 수정 불가 = 무결성 보장.

### 영향
- **`runEpisodeAnalysisPipeline` / `holisticBatchWorker`** = 분석 성공 후 fact 추출 패스 호출 path 신설 필요. 추출 라운드 의제.
- **`createServiceRoleClient` 헬퍼 신설** = 추출 라운드. `SUPABASE_SERVICE_ROLE_KEY` env 정합.
- **사용자 노출 사양 의제**: fold 결과 기반 분석 리포트 안 "정합성 팁" 섹션 추가 = UI 라운드.
- **NAT 사양 변동 0** = 추출 비용 본 분석 NAT 흡수 = `lib/nat.ts` 변경 X.
- **백필 없음** = 마이그레이션 안 backfill SQL 없음. 사용자 안내 의제 (분석 진입 시 fact 누적 시작).

---

## Future Work

### 단기
- **추출 파이프라인 라운드** = `createServiceRoleClient` + fact 추출 Haiku 패스 + entity upsert + fact INSERT path + 재분석 시 하드 교체 path. 본 ADR 결정 사양 그대로 구현.
- **시드 이관 스크립트** = `works.character_settings` → `work_entities` (UNIQUE 충돌 시 skip default, `source = 'seed'` 영속화).
- **충돌 탐지 1단 (ID 스키마) 구현** = 분석 시점 fold 계산 안 entity_ids 그룹화.
- **사용자 안내** = 가이드 페이지 / 온보딩 안 "분석 시작 = 바이블 누적 시작" 명시.

### 중기
- **충돌 탐지 2단 + 3단** = 결정적 코드 룰 + 조건부 Haiku 판정 path.
- **fact_type 확장 검토** = emotion_beat 등 (v1 미포함 사양).
- **fact 노출 UI** = 작가가 누적된 fact 를 회차별 / 인물별로 조회 path (read-only).
- **재분석 시 fact 보존 옵션** = 작가가 명시적으로 보존 선택 시 하드 교체 X path (단 무결성 vs 작가 편의 의제).

---

## Related Commits

- `7aca0f8`: feat(db): add work_bible entities + facts tables (v1)

---

## Notes

- v1 추출 범위 = `character` + `foreshadow` (5종 entity_type 스키마 개방 안 2종만 실 추출). 나머지 3종 (`faction` / `location` / `item`) = 스키마만 개방 + v2 진입 시 별도 추출 패스.
- v1 fact 추출 범위 = `event` / `state_change` / `relationship_change` / `foreshadow_planted` / `foreshadow_resolved` 5종 = 스키마 동일.
- `emotion_beat` 명시 제외 (LEE 사양 영속화).
- 본 ADR 은 schema 결정 영속화 = 추출 코드 path 결정은 별도 ADR 가능 (필요 시).
