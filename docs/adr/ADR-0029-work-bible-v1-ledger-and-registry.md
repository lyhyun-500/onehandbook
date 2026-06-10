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

## Entity Resolution Policy (PR-B 영속화)

### 결정적 후보 생성 (Haiku 호출 앞단)
- 한국 성씨 사전 (~100건, 통계청 2015 인구주택총조사) = 인라인 상수 (`src/lib/analysis/koreanSurnames.ts`).
- 한글 1글자 단성 ~95건 + 복성 7건 (남궁/황보/제갈/사공/선우/서문/독고).
- mention 첫 1-2글자 strip 후 registry 의 `canonical_name` + `aliases` 안 given-name suffix 매칭.
- 유일 후보 (1건) = 강한 힌트로 Haiku user 영역 주입 + 자동 alias 병합.
- 복수 후보 (2건+) = 전부 후보 제시, Haiku 가 brief 컨텍스트로 선택. 확신 부재 시 low confidence (< 0.5 = 서버 저장 X).
- 미매칭 (성씨 사전 미커버 / 외국식 이름 / 호칭/별호) = 호칭 path = Haiku 가 brief 컨텍스트 단독 판단.

### 자동 alias 병합 정책
- **유일 매칭 한정**. 모호 매칭 (2건+) = 병합 금지 = v2 병합 UI 의제.
- 매 회차 추출 시 신규 mention = 유일 후보 통과 시 entity.aliases 안 중복 제거 누적 (자가 치유).
- 결과: 추후 추출 라운드 가속 + 대명사/별호 자동 학습.

### confidence 임계값
- Haiku 출력 `confidence` 0.0 ~ 1.0.
- 서버 저장 임계값 = **0.5** (`MIN_CONFIDENCE`). 미만 = 저장 X (잡음 차단).

### 트랜잭션 사양
- 5단계 (entity insert / ref→ID / aliases / fact delete / fact insert) = 앱 레이어 best-effort.
- ④→⑤ 인접 (사이 호출 0) = facts 일관성 최대화.
- ⑤ 실패 = `console.error` (best-effort, 분석 결과 영향 0).
- 부분 실패 시 자가 치유: 재분석 시 ④ delete (idempotent) + ⑤ insert 재시도.

### Flag 가드
- env `WORK_BIBLE_EXTRACTION_ENABLED=true` (또는 `1`) = on. 기본 off.
- helper: `src/lib/config/workBibleExtraction.ts` (`isWorkBibleExtractionEnabled()`).
- 운영 활성화 순서: 시드 실행 (E2E → 운영) → 검증 → flag on.

---

## Re-analysis Policy (핫픽스 영속화)

### 결정 — content_hash 기반 idempotent 교체
- 추출 진입부 `content_hash` 게이트 = `extractAndApplyWorkFacts` 진입 첫 SELECT.
- 게이트 동작 진리표:

| 사양 | existing | 분기 | 동작 |
|---|---|---|---|
| 첫 분석 (fact 0) | `null` | 추출 진행 | Haiku 호출 + 5단계 영속화 |
| 동일 본문 재분석 | row + 동일 hash | **skip** | Haiku 호출 0, delete 0 |
| 퇴고 후 재분석 | row + 불일치 hash | 추출 진행 | ④ delete + ⑤ insert (하드 교체) |
| 백필 (캐시 히트 + fact 0) | `null` | 추출 진행 | 신규 fact 생성 |

### 캐시 히트 path 도 추출 발화
- `api/analyze/route.ts` 의 `cachedRun && acceptCached` 분기 = 후행 훅 진입.
- `sourceJobId = null` (캐시 히트 = `analysis_jobs` 신규 진입 0).
- 게이트 통과 시: 백필 복구 path (이전에 flag off 였던 회차의 fact 누락 복구).
- 게이트 skip 시: Haiku 토큰 0 = 비용 안전.

### 사양 정합
- ADR-0029 §결정 3 "백필 없음" 보강 — 백필 자체는 안 함 (자동 fact 생성 안 함), 단 캐시 히트 시 재분석 트리거 = 백필 복구 효과.
- ADR-0029 §결정 10 "재분석 시 fact 하드 교체" 정합 — 게이트 통과 시 ④ delete + ⑤ insert 인접 path 그대로.
- 동일 본문 재분석 시 잡음 fact 재생산 0 = 작가 fact 안정성 보장.

---

## Fold Injection Policy (L3 주입 영속화, v1)

### 결정 — content 기반 fold + system prompt 주입
- 단일 분석 path 단독 (`runAnalysis.ts`). 일괄(holistic) 경로 = v2 의제 (PR-C).
- 출력 = system prompt 안 추가 텍스트 블록 ("## 작품 바이블 — 이전 회차 누적 fact (read-only)").
- 빌더 = `src/lib/ai/buildWorkContextBlock.ts` (server-only).
- 입력 = `(workId, episodeNumber)`. `workId` 출처 = **파이프라인 work.id 단독** (사용자 입력 차단 = service_role RLS 우회 안전 조건).

### 시점 정합 (§결정 4 보강)
- 쿼리: `WHERE work_id = ? AND episode_number < N` 엄격 부등호.
- N 화 자체 fact 는 추출 후행 패스에서 생성 — fold 시점에 미존재 사실 = leak 차단.
- `episodeNumber <= 1` = 빈 블록 early return (이전 fact 0).

### 4그룹 압축 (LLM 토큰 절약 + 신호 보존)

| 그룹 | 사양 |
|---|---|
| ① 미회수 복선 | `foreshadow_planted` 의 foreshadow entity 집합 A − `foreshadow_resolved` 의 foreshadow entity 집합 B. 각 미회수 entity 별 가장 최근 planted fact 1건. |
| ② 인물 마지막 상태 | character entity 별 가장 최근 `state_change` fact 1건 (episode_number DESC, created_at DESC). |
| ③ 쌍별 마지막 관계 | `relationship_change` fact 의 sorted entity_ids pair 별 가장 최근 1건. |
| ④ 최근 핵심 사건 | `event` fact, 시간 역순. 남은 capacity 만큼. |

- content 텍스트 사용. `value` JSONB = 미사용 (충돌 검사 = v2 의제).
- 우선순위 truncate: ① > ② > ③ > ④. ④ event 가 가장 먼저 잘림.

### char budget = 2,000
- 한국어 ≈ 1.5 토큰/char → 2,000 char ≈ 3,000 토큰.
- 운영 Haiku usage 실측 후 보정.
- 우선순위 truncate = 그룹별 라인 누적, char_budget 초과 시 다음 그룹 절단.

### 빈 블록 생략 (system 무변경 보장)
- `buildSystemPrompt` 4번째 인자 `workContextBlock` = `trends` 와 동일 패턴 (`?.trim() ? ... : ""`).
- 빈 string / null / undefined = system prompt 변경 0 정합. parse.ts / parseHolistic.ts / 출력 JSON 계약 = 무변경.

### 추출-주입 flag 분리
- `WORK_BIBLE_EXTRACTION_ENABLED` (추출 후행 훅).
- `WORK_BIBLE_FOLD_ENABLED` (fold 주입, 신규).
- 독립 토글 = 추출만 on (fact 누적) 단계 후 fold 진입 path 가능.

### 점수 영향 = 회귀 검증 게이트
- fold on 후 분석 점수 / dimension comment 변동 = 검증 의제. 동일 작품 동일 회차 fold off 대 on 비교 path 권고.
- 분석 응답 latency 변동 = 운영 측정 의제 (fold 빌드 + system 토큰 증가).

### 스케일 축 (장기 해법 의제)
- **현 비용**: fold 비용 = 작품당 fact 수에 선형 (전역 테이블 무관). `idx_work_facts_fold (work_id, episode_number)` 인덱스로 풀스캔 회피.
- **장기 해법**: SQL 집계 (`DISTINCT ON` 그룹별 1건 PostgreSQL 추출) 또는 작품별 상태 스냅샷 테이블 (회차당 1 row, 상태 누적).
- **전환 시점**: 작품 장기화 (회차 100+) + 단위 작품 fact 수 폭증 시 = 의제 격상.

---

## Fold Injection Policy v2 — holistic 경로 확장 (PR-C 영속화)

### 결정 — single_call holistic path 단독 확장
- 일괄 분석 single_call path (1~10화) 안 fold 주입 + 회차별 fact 추출 진입.
- chunk + merge path (11화+) = 본 PR-C 범위 외. 운영 안 503 차단 (`analyze-batch-holistic/route.ts:81-90`) + 코드 안 의도적 미진입 = 이중 가드.

### N 사양 — segments.min(episode_number)
- 단일 호출 path = LLM 1회 = system prompt 1개 = fold 1개 사실.
- N = 묶음의 min(episode_number) (이전 회차 fact 단독 인입, leak 차단 정합).
- `segments.length === 0` 가드 = `Math.min(...[])` = `Infinity` 회피.

### work_id 주입 게이트
- `analysisInputBase` 안 `work_id: work.id` 주입 (`holisticBatchWorker.ts:283`, finalizeSingleHolisticRun path 단독).
- `runHolisticAnalysis` 안 fold 게이트 = `typeof input.work_id === "number"` 검사. chunk path (`holisticChunkAnalysis.ts:139`) = `work_id` 의도적 미주입 → 자동 skip.
- chunk path 활성화 시 = `work_id: work.id` 1줄 추가하면 fold 자동 적용 (코드 변경 0 정합).

### 추출 후행 훅 — 회차별 순차
- `finalizeSingleHolisticRun` 마지막 (syncPerEpisode 직후, return 직전) 안 `after()` 백그라운드.
- 회차별 for-await 순차 (병렬 금지 — work_facts 동시 insert race 회피).
- 회차별 `md5Hex(content)` 단독 해시 — `extractAndApplyWorkFacts` content_hash 게이트 정합.
- 회차별 try/catch — 1 회차 실패 시 다음 회차 계속 (best-effort).
- `extractAndApplyWorkFacts` 시그니처 변경 0 (단일 path 재사용).

### maxDuration 마진 사실 (운영 측정)
- base usage = 171~343초 (8~10화 single_call). 추출 worst = 10화 × Haiku 15초 = 150초.
- 누적 = 493초 < `maxDuration = 800` (`/api/analyze/process/route.ts:17`). 시간 가드 불필요.
- content_hash 게이트 히트 시 회차당 < 1초 (Haiku 호출 0).

### merge path 미진입 (PR-C 범위 외)
- `buildHolisticMergeSystemPrompt` 4번째 인자 추가 = v2 의제 외. merge path 자체 = chunk path 의존 → 본 PR-C 안 미진입.
- v3 의제 = chunk path 503 해제 + merge path fold/추출 + chunk 결과 → fact 영속화 path.

---

## PR-C 운영 검증 결과 (2026-06-10)

### 검증 사실 — 일괄 single_call holistic 안 fold 정상 동작
- 운영 main = `fa37b97` (PR #34 머지) 적용 후 임시 debug 로그 (`9e49473`) 진입 → 회귀 검증 후 revert (`059ebff`) path.
- 검증 분석 = `workId = 20`, `episodeIds = 38~47` (single_call, 10화).

### 측정 매트릭스

| 항목 | 측정 값 | 사실 결론 |
|---|---|---|
| `typeofWorkId` | `"number"` | C1 (`92059ff`) work_id 주입 = runtime 정합. `analysisInputBase.work_id` 정상 인입 사실 |
| `episodeNumber` (N) | `38` | C2 (`d88c2c1`) `segments.min(episode_number)` 계산 정합. 묶음 첫 회차 사실 |
| `blockLength` | **1970 char** | char budget 2,000 안 거의 채워짐. 미회수 복선 11화까지 장거리 fold 인입 확인 |
| 회차별 fact 영속화 | 18~37 누락 0 | C3 (`274a398`) 추출 훅 for-await 순차 동작 정합 |

### dispatch path 사실
- `analyze-batch-holistic/route.ts:311` 안 `after(runAnalysisProcessAfterResponse)` 의 self-HTTP trigger 실패 사실 발생 → `executeAnalysisJob` direct fallback path 안 진입.
- direct fallback path 안에서도 fold 정상 작동 사실 확인 = `runAnalysis.ts:332-348` fold 블록 path 단일 (dispatch 방식 무관).

### maxDuration 마진 사실 (실측 통합)
- base usage = 171~343초 (8~10화 single_call holistic, 운영 측정).
- 추출 worst = 10화 × Haiku 15초 = 150초.
- 누적 = **493초 < `maxDuration = 800`초** (`/api/analyze/process/route.ts:17`).
- 안전 마진 충분, 시간 가드 미진입 사양 정합.

### 결론
- C1/C2/C3 = 운영 안 정상 동작 확증 사실 영속화 완료.
- fold 본질 통과 (a) flag + work_id 가드, (b) `work_facts` 누적 + buildWorkContextBlock 정상 반환, (c) system prompt 안 주입 — 3 단계 전부 정합.
- "일괄 fold 진짜 도는가" 의제 = 본 영속화 안 해소. 후속 회귀 시 본 측정 매트릭스 안 baseline 정합 path.

---

## Related Commits

- `7aca0f8`: feat(db): add work_bible entities + facts tables (v1)
- `20dc3a1`: Merge pull request #28 (schema main 머지)
- `badc3ce`: feat(infra): work-bible extraction 인프라 (PR-A) — serviceRole server-only, flag helper, seed script
- `57b447a`: feat(extraction): work-bible fact 추출 본체 (PR-B) — 8 파일
- `45095cd`: Merge pull request #29 (extraction main 머지)
- `9041815`: fix(work-bible): 추출 idempotency + 캐시 히트 발화 (Re-analysis Policy 영속화)
- `d5d740b`: Merge pull request #31 (after() + 게이트 가드 main 머지)
- `4419411`: fix(work-bible): 과잉 추출 튜닝 — fact 규칙 프롬프트 강화
- `75d57c8`: feat(work-bible): L3 fold 주입 v1 — 단일 분석 경로 (Fold Injection Policy 영속화)
- `92059ff`: feat(work-bible): holistic single-call path work_id 주입 (PR-C C1)
- `d88c2c1`: feat(work-bible): holistic fold L3 주입 v1 — 단일 호출 path (PR-C C2)
- `274a398`: feat(work-bible): holistic 추출 훅 — 단일 호출 path 회차별 순차 (PR-C C3)
- `8af9e90`: docs(adr): ADR-0029 + Fold Injection Policy v2 영속화 (PR-C C4)
- `fa37b97`: Merge pull request #34 (PR-C main 머지)
- `9e49473`: chore(work-bible): 임시 fold 런타임 디버그 로그 (PR-C 운영 검증용, revert 예정)
- `059ebff`: Revert "chore(work-bible): 임시 fold 런타임 디버그 로그" (검증 완료 후 제거)

---

## Notes

- v1 추출 범위 = `character` + `foreshadow` (5종 entity_type 스키마 개방 안 2종만 실 추출). 나머지 3종 (`faction` / `location` / `item`) = 스키마만 개방 + v2 진입 시 별도 추출 패스.
- v1 fact 추출 범위 = `event` / `state_change` / `relationship_change` / `foreshadow_planted` / `foreshadow_resolved` 5종 = 스키마 동일.
- `emotion_beat` 명시 제외 (LEE 사양 영속화).
- 본 ADR 은 schema 결정 영속화 = 추출 코드 path 결정은 별도 ADR 가능 (필요 시).
