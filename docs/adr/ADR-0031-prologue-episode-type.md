# ADR-0031: 프롤로그 도입 — `episodes.episode_type`

- **Status**: Accepted
- **Date**: 2026-06-15
- **Related**: ADR-0029 (작품 바이블 v1), ADR-0030 (회차 재정렬), CLAUDE.md §NAT 정책

---

## Context

### 발견 경위
- 작가 요청 — 작품 시작 전 도입부 ("프롤로그") 작성/분석 사양 부재.
- 일반 회차 안 = 6 축 평가 + 글자 등급 NAT (1~2 NAT). 프롤로그 안 = 본격 갈등/성장 사실 0 → 일반 회차 사양 안 평가 갭.

### 문제 정의
- 프롤로그 = 독립 회차 의미 vs 본편 1화 안 통합 의미 안 갭.
- NAT 사양 / 분석 사양 / 재정렬 사양 안 본편/프롤로그 분리 필수.

---

## Decision

### 결정
- **`episodes.episode_type` TEXT 컬럼 신설** — `'episode' | 'prologue'` 단독 CHECK.
- **프롤로그 = `episode_number = 0` 단독** 고정. 본편 = 1..N 단독. 작품당 프롤로그 1개 제약 (partial unique index).
- 재정렬 RPC = 본편 단독 사양 (프롤로그 변동 0).
- NAT = 프롤로그 안 3천자 미만 = 0, 이상 = 1 (단일 / 일괄 동일). 본편 = 현행 유지.
- 분석 prompt = 프롤로그 전용 사양 분기 (6 축 본질 유지, 평가 관점 갱신).
- fold (`buildWorkContextBlock`) = 1화 분석 시점 안 프롤로그 fact 인입 정합 (`<= 0` early return).
- label = "프롤로그" 단독 (UI 안 "EP.00" 대신).

### 근거
- 별도 컬럼 (`episode_type`) = 의미 분리 안 명확 + 영향 path 안 controlled.
- `episode_number = 0` 고정 = 기존 SELECT/ORDER BY 사양 안 자연 통합 (정렬 안 첫 위치 단독 정합).
- partial unique index = race 안전망 (앱 레벨 pre-check 단독 안 동시 진입 안 갭 차단).

---

## Alternatives Considered

### 옵션 A — 별도 `prologues` 테이블 신설
- 동작: 프롤로그 단독 테이블 안 분리. 본편 = `episodes` 단독.
- 단점: SELECT 사양 안 다중 JOIN 사실 + work_facts FK 안 분리 사양 + fold path 안 통합 사실 복잡.
- 기각.

### 옵션 B — `episodes.episode_type` 컬럼 + episode_number = 0 (채택) ⭐
- 동작: 단일 테이블 안 type 분기 + 정렬 안 자연 통합.
- 장점: 기존 SELECT/ORDER BY 사실 단독 정합 + work_facts/work_entities 사양 안 자동 호환.

### 옵션 C — `episodes.episode_number = -1` 사양 (프롤로그 = 음수)
- 동작: 음수 사양 안 정렬 안 첫 위치 단독.
- 단점: CHECK `episode_number >= 0` 안 음수 허용 사양 진입 + UI 안 "EP.-1" 사양 안 부자연.
- 기각.

---

## Tradeoffs

### 0 NAT 분석 안 악용 표면 사실
- 무제한 작품 생성 (개수 제한 0 사실) + 작품당 프롤로그 1건 = N 작품 안 N건 무료 분석 잠재.
- 현 사양 = **백로그 단독 영속화** (운영 안 모니터 path).
- 처방 옵션 (미진입):
  - 사용자당 작품 N개 제한 (베타 안 5건 / 스탠다드 안 무제한).
  - 프롤로그 무료 분석 일/월 N회 제한.
  - 사용자당 프롤로그 무료 평생 N건 제한.

### prompt 안 6 축 본질 유지 사실
- 프롤로그 전용 평가 관점 = 첫 훅·세계관·인물 첫 등장·후속 견인 단독 가중.
- 단, **6 축 자체 = 본편/프롤로그 동일 사양 유지** (UI 안 차트 사실 정합 안 일관 정합).
- 작가 view 안 동일 6 축 안 score 사실 + 코멘트 안 프롤로그 사양 단독 분기.

### 통합 점수 안 프롤로그 제외 사실
- 일괄 분석 안 묶음 안 프롤로그 포함 시 = 통합 `overall_score` 안 프롤로그 합산 제외 단독.
- 사용자 view 안 = "통합 점수 = 본편 단독 사실" 안 명시 안 path 0 (UI 안 부재). 후속 의제.
- 영향 = 사용자 안 의문 잠재 (프롤로그 점수 = 70, 본편 평균 = 85, 통합 = 85 사실 안 view).

---

## Decision Detail

### Schema 사양 (C1)

```sql
ALTER TABLE public.episodes
  ADD COLUMN episode_type TEXT NOT NULL DEFAULT 'episode'
  CHECK (episode_type IN ('episode', 'prologue'));

ALTER TABLE public.episodes
  DROP CONSTRAINT episodes_episode_number_check;
ALTER TABLE public.episodes
  ADD CONSTRAINT episodes_episode_number_check CHECK (episode_number >= 0);

CREATE UNIQUE INDEX one_prologue_per_work
  ON public.episodes(work_id)
  WHERE episode_type = 'prologue';
```

### 재정렬 RPC 사양 (C2)
- 본편 (`episode_type = 'episode'`) 단독 재정렬, 프롤로그 변동 0.
- 7 사이트 안 `AND episode_type = 'episode'` 필터:
  - SELECT FOR UPDATE / expected count / actual count / MAX offset / pass 1 / pass 2 / work_facts UPDATE.

### NAT 사양 (C5)
- **단일 path**: `computeNatCost(charCount, opts, episodeType?)` — 프롤로그 시 `prologueNatCost(charCount)` 분기.
  - `prologueNatCost(n) = n < 3000 ? 0 : 1`.
- **일괄 path** (D-9 결정 — array 인입 path 단독):
  - `computeHolisticNatCost(episodes: HolisticEpisodeNatInput[], opts)` — per-episode 합산.
  - `computeHolisticChunkNatCost(episodes: HolisticEpisodeNatInput[], chunkIndex, opts)` — 동일.
  - 본편 = 회차당 1 NAT 단독, 프롤로그 = `prologueNatCost(charCount)` 단독.
- **MIN_ANALYSIS_CHARS 면제**: 프롤로그 안 500자 차단 0 (3 사이트 — analyze/route, runEpisodeAnalysisPipeline, analyze-batch-holistic + holisticBatchWorker + holisticChunkAnalysis).

### 분석 prompt 사양 (C3 + C4)
- **단일 (`buildSystemPrompt`)**: 5번째 인자 `episodeType` — `'prologue'` 시 `PROLOGUE_DIMENSIONS` 단독 (CORE_DIMENSIONS 대체).
- **일괄 (`buildHolisticSystemPrompt`)**: 5번째 인자 `hasPrologue` — 묶음 안 `episode_number === 0` 사실 시 `HOLISTIC_PROLOGUE_RULE` 박음.
- **merge (`buildHolisticMergeSystemPrompt`)**: 4번째 인자 `hasPrologue` — chunk 결과 통합 안 동일 사양.

### 통합 점수 사양 (C4)
- `buildHolisticDisplay` 안 `orderedEpisodes[i].episode_type` 인입.
- 프롤로그 안 `num/den` 합산 제외 (chartPoints 안 포함 단독, label = "프롤로그").

### fold 사양 (C6)
- `buildWorkContextBlock` early return `<= 1` → `<= 0` 완화.
- 효과:
  - 프롤로그 자체 분석 (N=0) = early return 안 fold 0 정합.
  - 1화 분석 (N=1) = `< 1` SELECT → 프롤로그 fact (episode_number=0) 포함 정합 ★.

### label 사양 (C6)
- `formatEpisodeLabel` 안 `episode_number === 0` → "프롤로그" 단독 분기.
- 본편 = 기존 "EP.NN" 사양 유지.

### 생성 흐름 사양 (C7)
- `WorkDetailHeader` 안 「프롤로그 추가」 button 신설 — hasPrologue disable + 동일 스타일.
- `/episodes/new?type=prologue` 안 query param 분기.
- `EpisodeEditForm` 안 `type?: "episode" | "prologue"` prop + insert payload 안 `episode_type` 인입.
- 23505 (partial unique violation) 안 catch 사양 — "이미 프롤로그가 있습니다" 명시 메시지.

---

## Risks (백로그 영속화)

### R-1 (M4) — 작품 무제한 생성 안 악용 표면
- 사실: `AddWorkButton.tsx:61-69` 안 개수/빈도 제한 0.
- 영향: 무제한 작품 생성 + 작품당 프롤로그 무료 분석 = 반복 무료 분석 잠재.
- 처방 옵션 = 위 Tradeoffs 영속화 (백로그 단독, 본 PR scope 외).

### R-2 — 통합 점수 안 프롤로그 제외 안 UI 사양 부재
- 일괄 분석 안 통합 점수 = 본편 단독 가중 평균 사실.
- UI 안 "통합 점수 = 본편 단독" 명시 path 0 → 사용자 view 안 의문 잠재.
- 처방 = 별도 UI PR 안 안내 영속화 의제 (analysis result page 안 통합 점수 인근).

### R-3 — Holistic chunk path (11화+) 안 503 차단 사실
- ADR-0030 안 사양 유지 (`analyze-batch-holistic/route.ts:81-90`).
- 묶음 안 프롤로그 포함 시 = 본편 10화 + 프롤로그 1건 = 11건 → 503 사실.
- 사용자 view 안 = 본편 9화 + 프롤로그 1건 안 권고 단독 사양.
- 처방 의제 = chunk 안 본편 단독 카운트 사양 진입 path (별도 PR).

---

## R-4 (CLAUDE.md NAT 정책 정정 영속화)

### LEE 사양 갭 사실
- LEE 안 CLAUDE.md 안 "3,000자 미만 차단 + 1/2/3 등급" 인식 사실 영속화.
- 코드 사실 (`manuscriptEligibility.ts:2` + `nat.ts:21-26`):
  - **MIN_ANALYSIS_CHARS = 500** (분석 차단 하한).
  - **NAT 등급 = 2 tier 단독**: ≤6000 = 1 NAT / >6000 = 2 NAT (DB CHECK 안 ≤10,000 단독).
  - "10,001자 이상 = 3 NAT" 사양 안 코드 미반영 사실 (CHECK 안 도달 불가).

### 본 PR 안 결정
- **코드 사실 영속화 단독** (LEE 사양 안 코드 변경 0 사양 정합).
- 프롤로그 안 본 사실 정합 = 500자 차단 면제 + 3천 미만 0 NAT 사양 단독.
- CLAUDE.md 안 NAT 정책 사양 갱신 의제 = **별도 PR 단독** (본 ADR 안 사실 영속화 후 후속 path).

---

## Future Work

### work_entities.first_seen_episode 안 프롤로그 사실
- 프롤로그 (episode_number = 0) 안 first_seen 사양 = 자연 정합 (ADR-0030 안 frozen 사양 영속화 단독, 본 PR 안 변경 0).
- backfill path 진입 시 = 프롤로그 fact (`work_facts.episode_number = 0`) 안 가장 첫 mention 사양 정합.

### 작품 생성 제한 사양
- 위 R-1 영속화. 운영 안 모니터 통과 후 결정 의제.

### chunk path 안 본편 단독 카운트
- 위 R-3 영속화. 별도 PR 안 진입 의제.

### CLAUDE.md NAT 정책 갱신
- 위 R-4 영속화. 별도 PR 안 진입 의제.

---

## Lessons — 말단 누락 체크리스트 (M4 후행 영속화)

### 발견 경위
- M4 안 STEP 0 / STEP 1 / STEP 2 (8 commit) 충실 진입 후 운영 검증 안 **hotfix 6회 (C9~C14) 사실 발생**.
- 단일 뿌리 = `episode_type` / 프롤로그 / 0 NAT 분기 사실 안 **서버 핵심 경로 (분석 pipeline / NAT 계산 / fold) 단독 박힘 + 말단 사이트 안 미반영 사실 영속화**.

### M4 안 발견된 말단 누락 6 카테고리

#### (1) 라벨 표시 — `formatEpisodeLabel` 미경유 안 `${n}화` 직접 보간 사이트
- **C9**: `EpisodeEditForm.tsx:198` 안 form 안 자체 헤더 "0화" 표시 사실.
- **C11 (b-g, k)**: `EpisodeTrendChart.tsx:104` (x축 tick), `BatchAnalyzeModal.tsx:723, 726` (aria-label + EP.NN prefix), `WorkNotesDrawer.tsx:306` + `SettingsDrawer.tsx:711` (메모 라벨), `BatchContentUnchangedModal.tsx:48` + `AnalysisAsyncUnchangedModal.tsx:228` (`변경 없음: N화` 단독).
- 검증 사양 = `grep -rn '}화\|]화\|화\`' src` 단독 + per-episode 라벨 vs count 단독 분류 path.

#### (2) NAT 표시 / 계산 — `buildNatBreakdown` / `computeNatCost` 호출처 안 `episode_type` 인입
- **C10**: `AnalyzePanel.tsx:512` 안 3번째 인자 미인입 → 프롤로그 안 1 NAT 잘못 표시 사실.
- **C11 (a)**: `buildAnalyzeJobPollResponse.ts:278` 안 polling response 안 동일 사실.
- 검증 사양 = `grep -rn 'buildNatBreakdown\|computeNatCost\|getManuscriptAnalysisTier' src --include="*.ts*"` 전수.

#### (3) 차감 실행 — RPC 안 0 / 특수값 거부 사실
- **C12**: `consume_nat` RPC 안 `p_amount < 1` 거부 사양 안 호출자 안 "NAT 부족" 매핑 단독 + `analysis_runs` DELETE 사실 → 0 NAT 분석 결과 손실 + 에러 표시 사실.
- 검증 사양 = **사전 balance check 단독 검증 path 0**. 실제 차감 RPC / DB CHECK 안 0 / 음수 / NULL 거부 사실 안 호출자 안 매핑 path 추적 필수.

#### (4) 정렬 / 재정렬 — sortable items + 저장 입력 + 정렬 방향별 위치
- **C13**: `EpisodeListWithReorder.tsx` 안 sortable items 안 프롤로그 ID 포함 + `save()` orderedEpisodeIds 안 프롤로그 ID 포함 → reorder RPC 안 `ordered_ids_mismatch` 사실 (C2 안 본편 단독 expected_count 정합 안 미정합).
- **C14**: 일반 보기 안 sortMode 무관 프롤로그 상단 고정 사실 → desc (최신순) 시 프롤로그 = 맨 아래 사양 안 미정합.
- 검증 사양 = sortable 컴포넌트 안 (a) items array (b) save payload (c) 정렬 방향별 자연 위치 3 path 전수 추적.

#### (5) frozen JSON — server-side 라벨 안 merge 결과 안 박힘 사실
- **C11 (j)**: `analyze-batch-holistic-merge/route.ts:458` + `holisticBatchWorker.ts:453` 안 chunk `rangeLabel` 안 `${lo}화` 직접 보간 사실 — merge JSON 안 frozen 영속화.
- 검증 사양 = 서버 path 안 사용자 안 보이는 텍스트 안 frozen JSON 안 박힘 사실 추적 (라벨 / 메시지 / 요약 anything).

#### (6) 클라 인입 path 안 4 사이트 단계 검증 (C10 path 영속화)
- server SELECT → page.tsx props → 중간 컴포넌트 props → 말단 컴포넌트 props 안 4 단계 안 전수 인입 사실.
- 검증 사양 = page.tsx 안 episode SELECT 안 컬럼 인입 + props 매핑 chain 전수 grep path 단독.

### verify 교훈

**"돈 안 쓰는 경로 (0 NAT / 무료 path) = 사전 체크 통과 단독 검증 path 안 불충분 사실"**.

- M4 C5 verify (Q3/Q7) 안 = "balance < cost" 사전 check 단독 검증 path → 통과 정합 (cost=0 안 balance < 0 사실 = false).
- 운영 실제 사실 = consume_nat RPC 안 `p_amount < 1` 거부 사실 단독 → 본 verify path 안 미진입 사양.
- → **검증 사양 = 실제 실행 경로 (LLM 호출 → row INSERT → 차감 RPC → 결과 유지) 안 끝까지 따라가 사실 검증 단독**.

### 신규 사양 (Episode 파생 필드 / 특수 타입 추가 시 STEP 0 안 필수 진입 path)

본 6 카테고리 안 grep + trace 단독 path 안 STEP 0 안 별도 단계 영속화 사양. **`episode_type` / 신규 enum / 특수값 (`0` / `null` / `negative`) 추가 진입 시 본 체크리스트 안 단독 활용 사양**.

---

## Related Commits

- `e837b78`: feat(db): episodes.episode_type + 프롤로그 schema 사양 (C1)
- `f012ead`: feat(db): reorder_episodes 프롤로그 제외 (C2)
- `1279e6b`: feat(analysis): AnalysisInput.episode_type + 단일 프롤로그 prompt (C3)
- `8bd1b2b`: feat(analysis): 일괄 프롤로그 통합점수 제외 + holistic prompt 분기 (C4)
- `a6c99b0`: feat(nat): 프롤로그 NAT 분기 (단일 + 일괄) (C5)
- `1c1fbe9`: feat(episodes): fold <=0 완화 + episodeLabel 프롤로그 분기 (C6)
- `45acac7`: feat(episodes): 프롤로그 추가 버튼 + 생성 흐름 (C7)
- `873dd17`: docs(adr): ADR-0031 영속화 (C8)
- `b9716f8`: fix(episodes): 프롤로그 헤더 라벨 0화 → 프롤로그 (C9, hotfix line 1 — label)
- `9c38109`: fix(episodes): 프롤로그 분석 진입 500 면제 + NAT 0 표시 (C10, hotfix line 2 — NAT 표시)
- `f56de7f`: fix(episodes): 프롤로그 라벨/NAT 클라 표시 누락 일괄 보정 (C11, hotfix 11 사이트 전수)
- `49350c1`: fix(nat): 0 NAT 분석 시 consume_nat 호출 skip (C12, hotfix line 3 — 실행 path)
- `049811e`: fix(episodes): 순서 편집 시 프롤로그 드래그 제외 + 맨 앞 고정 (C13, hotfix line 4)
- `73c3f66`: fix(episodes): 일반 보기에서 프롤로그 정렬 참여 (C14, hotfix line 4 후속)

---

## Notes

- 운영 적용 순서 사실:
  1. C1 + C2 migration = LEE Studio SQL Editor 수동 적용 (CLI 권한 부재).
  2. 적용 후 검증 SQL (컬럼 + CHECK + partial unique + RPC 정의) 통과 사실 확인.
  3. C3~C7 코드 + C8 ADR = main 머지 → Vercel 자동 배포.
  4. 운영 시각 검증 = LEE path (8 항목 — 단일 프롤로그 분석 + [프롤로그+1화] 일괄 + 통합점수 + 재정렬 + 버튼 disable + fold 1화).
- 본 ADR 안 결정 = 운영 검증 후 갱신 의제 (실측 + 사용자 피드백 영속화).
