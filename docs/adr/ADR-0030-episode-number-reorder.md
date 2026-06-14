# ADR-0030: 회차 번호 = 연재 순서값 재정의 + 수동 재정렬 RPC

- **Status**: Accepted
- **Date**: 2026-06-11
- **Related**: ADR-0029 (작품 바이블 v1), `20260611120000_episodes_reorder_rpc.sql`

---

## Context

### 발견 경위
- 작가 요청 — 회차 작성 후 순서 변경 사양 부재. 신규 회차 등록 시 마지막 위치 단독 고정.
- 별도 `display_order` 컬럼 신설 vs `episode_number` 의미 재정의 — 의제.

### 문제 정의
- `episode_number` = "불변 식별자" + "연재 순서값" 두 의미 안 충돌. 재정렬 시 의미 갭 발생 잠재.

---

## Decision

### 결정
- **`episode_number` = 연재 순서값 재정의**. `episode_id` = 불변 앵커 단독.
- 별도 `display_order` 컬럼 신설 X.
- 수동 재정렬 RPC `reorder_episodes(p_work_id, p_ordered_episode_ids)` 신설.

### 근거
- 별도 컬럼 신설 = 8 SELECT/ORDER BY 사이트 수정 (회피 사양). UI 표시 사이트 전수 = `episode_number` 단독 read 사실 = 자동 정합 path.
- `episode_id` FK 안 fold/work_facts 정합 사실 = `episode_number` 재정의 안 의미 갭 해소 path.

---

## Alternatives Considered

### 옵션 A — 별도 `display_order` 컬럼 신설
- 동작: `episodes.display_order INT` 추가. 모든 ORDER BY 안 본 컬럼 단독 사용.
- 단점: 8 사이트 + UI 표시 사이트 전수 수정 사양 (scope 폭증).
- 기각.

### 옵션 B — `episode_number` 재정의 (채택) ⭐
- 동작: `episode_number` 의미 = 연재 순서값 단독. RPC 안 동기 갱신.
- 장점: UI / SELECT 사이트 전수 변경 0. `episode_id` 안 앵커 사양 정합.

### 옵션 C — 사용자 안 정렬 키 (예: 사용자 입력 안 weight 1.5 등)
- 동작: 부동소수 weight 안 정렬. swap 안 weight 중간값 박음.
- 단점: 의미 불명확 + UI 안 "N화" 표시 사양 안 갭.
- 기각.

---

## Decision Detail — RPC 사양

### 갱신 대상

| 테이블 | 컬럼 | 갱신 방식 |
|---|---|---|
| `episodes` | `episode_number` | 입력 배열 순서대로 1..N 재할당 |
| `work_facts` | `episode_number` | `episode_id` 앵커 JOIN, 자동 동기 |

### 갱신 0 사양 (frozen)

| 위치 | 사실 |
|---|---|
| `work_entities.first_seen_episode` | 옵션 (c) 채택 — read 사이트 0 (코드 grep 사실). UI 노출 진입 시 별도 backfill PR 의제 |
| `work_facts.episode_content_hash` | 본문 hash 단독 사실. episode_number 무관. 갱신 0 정합 (Q6) |
| `analysis_runs.result_json` | 분석 당시 episode_scores snapshot 사실. 의도된 history 정합 |
| `holistic_analysis_runs.result_json` | 동일 사실 |
| `analysis_jobs.payload` | 진단용 snapshot |
| `holistic_pipeline_events.payload` | 진단용 snapshot |
| `reports.result_json` | 리포트 본문 안 snapshot |
| `reader_actions.episode_number` | episode_id FK 부재 사실 (백로그 R-1, 실유저 0 사양 단독 정합) |

### 가드 사양

| # | 가드 | 위치 |
|---|---|---|
| 1 | 권한 검증 — `auth.uid() → users.id → works.author_id` 일치 사실 | RPC 안 |
| 2 | 진행 중 분석 잡 차단 (Q7 이중 가드) | UI + RPC 양쪽 |
| 3 | `SELECT FOR UPDATE` — episodes 잠금 (동시 재정렬 race 차단, Q8) | RPC 안 |
| 4 | 입력 검증 — empty / 중복 / 길이 / 전수 일치 | RPC 안 |

### UNIQUE 충돌 회피

- `episodes_work_id_episode_number_key` 제약 안 DEFERRABLE 0 사실.
- 회피 사양 = `MAX + 1000000` offset 안 2-pass:
  - pass 1: 모든 row 안 `(원 값 + offset)` 임시 박음 → UNIQUE 충돌 0.
  - pass 2: 입력 배열 순서대로 1..N 재할당 (앵커 = id).

---

## Tradeoffs

### frozen snapshot 안 의미 갭 사실
- 분석 완료 회차 안 재정렬 = `analysis_runs.result_json.episode_scores[].episode_number` snapshot 안 frozen 사실 vs 현 `episodes.episode_number` 안 갭.
- UI 안 차트 / 리포트 표시 시 = 분석 당시 회차 번호 단독 사실.
- 처방 = 안내 메시지 단독 (toast 안 "이미 분석한 회차의 차트는 분석 당시 번호로 표시됩니다" 영속화).

### `first_seen_episode` frozen 사실
- 추출 시점 episode_number 단독. 재정렬 후 정확성 미보장.
- read 사이트 0 사실 = 사용자 노출 0 = 영향 0.
- UI 노출 사양 진입 시 = 별도 PR 안 `first_seen_episode_id BIGINT FK` 컬럼 신설 + backfill + RPC 안 갱신 path 추가 의제.

---

## Risks (백로그 영속화)

### R-1 — `reader_actions` 안 episode_id FK 부재
- 사실: `reader_actions.episode_number` 단독, episode_id FK 0.
- 영향: 재정렬 시 historical 통계 mix 잠재.
- 현 사양: 실유저 0 + 운영 통계 사용 0 사실 → **갱신 0 사양 단독 정합**.
- 백로그: 통계 운영 진입 사양 시 = `reader_actions.episode_id BIGINT FK` 컬럼 신설 + backfill + `ReaderTracker.tsx` 안 insert path 동시 인입 + 본 RPC 안 갱신 path 추가 의제.

### R-2 — frozen snapshot 안 의미 갭
- 사실: 분석 결과 안 `episode_number` snapshot 다수 사실 (위 frozen 사양 매트릭스).
- 영향: 차트 x축 / 리포트 본문 안 의미 변동.
- 처방: 사용자 안내 (저장 성공 toast 안 영속화). 재분석 강제 X.

### R-3 — `episodes_work_id_episode_number_key` DEFERRABLE 0
- 회피 사양 = 2-pass offset 단독.
- 백로그: `ALTER TABLE ... ALTER CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED` 진입 = 단순화 잠재 의제.

### R-7 — fold 맥락 갱신 사실
- 본 RPC 안 `work_facts.episode_number` 동기 갱신 사실 = fold 안 "N화 이전 fact" 의미 = 새 순서 정합.
- 단 fold 안 추출 시점 본문 (재정렬 전 분석된 episode) 안 ↔ 현 episode_number 안 갭 잠재.
- 처방: 안내 메시지 단독 (재분석 권고, 강제 X).

---

## Q7 이중 가드 사양 (영속화)

본 결정 안 핵심 사양 = 진행 중 분석 잡 안 재정렬 동시 진입 차단.

### UI 가드 (사용자 1차 보호)
- `page.tsx` 안 `analysis_jobs WHERE work_id AND status IN ('pending', 'processing')` count.
- `busyJobCount > 0` 시 「순서 편집」 button disable + 배너 안내.

### RPC 가드 (race 안전망)
- UI 가드 통과 후 client → RPC 사이 안 신규 분석 잡 진입 잠재.
- RPC 안 동일 쿼리 안 재확인 → `analysis_in_progress` 거부 (HTTP 409).

→ **2 가드 사실 = race 차단 사양 영속화**.

---

## Future Work

### work_entities.first_seen_episode 갱신 path
- 신규 컬럼: `first_seen_episode_id BIGINT REFERENCES episodes(id)`.
- backfill: `work_facts` 안 처음 mention 한 episode_id 사실 단독.
- 본 RPC 안 갱신 1줄 추가: `UPDATE we SET first_seen_episode = e.episode_number FROM episodes e WHERE we.first_seen_episode_id = e.id`.
- 트리거 사양 = UI 안 first_seen 노출 사양 진입.

### reader_actions episode_id FK
- 신규 컬럼: `reader_actions.episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE`.
- backfill: `(work_id, episode_number)` 안 join 안 episode_id 사실 단독.
- `ReaderTracker.tsx` 안 insert path 안 episode_id 동시 인입.
- 본 RPC 안 갱신 path 의제.
- 트리거 사양 = 운영 통계 활성화 진입.

### DEFERRABLE constraint
- 사양 = `ALTER TABLE public.episodes ALTER CONSTRAINT episodes_work_id_episode_number_key DEFERRABLE INITIALLY DEFERRED`.
- 효과 = 2-pass offset 사양 단순화 (1-pass 진입 path).
- 트리거 사양 = 본 RPC 안 단순화 의제.

### 에디터 이탈 가드 안 popstate (브라우저 뒤로가기) 미진입 사양
- `useAnalysisNavigationGuard` 안 popstate 가드 = App Router 안 history 조작 충돌 사실로 폐기 (M3 영속화).
- 결함 사실: (1) confirm OK 시 dummy entry 안 잔존 → 이중 뒤로가기 필수, (2) `router.replace` 안 dummy entry 단독 교체 → 원본 entry 잔존 = 의도된 history 정합 깨짐.
- 현 가드 = `beforeunload` + 내부 `<a>` click capture 단독.
- 뒤로가기 가드 사양 진입 시 = App Router 공식 path (`useRouter().events` 또는 차후 Next.js 안 공식 API) 안 재구현 의제.

---

## Related Commits

- `601e12f`: feat(db): reorder_episodes RPC migration (C1, FOR UPDATE 집계 분리 사실 포함)
- `52b621c`: feat(api): /api/works/[workId]/episodes/reorder 신설 (C2)
- `92097ad`: feat(ui): 회차 순서 편집 모드 + 드래그 (@dnd-kit) (C3)
- `b4f9583`: fix(episodes): 신규 회차 번호 count+1 → MAX+1 (C4)
- `deb903a`: fix(ui): 회차 정렬 토글 동작 + 편집 모드 asc 강제 복귀 (M1 후속)

---

## Notes

- 운영 적용 순서 사실:
  1. C1 migration = LEE Studio SQL Editor 수동 적용 (CLI 권한 부재).
  2. 적용 후 검증 SQL (RPC 정의 / GRANT / dry-run) 통과 사실 확인.
  3. 코드 (C2~C4) main 머지 → Vercel 자동 배포.
  4. UI 안 시각 검증 (편집 모드 진입 + 드래그 + 저장 + busy 가드 + frozen 안내).
- 본 ADR 안 결정 = 운영 검증 후 갱신 의제 (실측 결과 + 사용자 피드백 영속화).
