# ADR-0032: 회차 삭제 — atomic delete + 본편 재배치

- **Status**: Accepted
- **Date**: 2026-06-18
- **Related**: ADR-0030 (회차 재정렬), ADR-0031 (프롤로그), `reorder_episodes` RPC

---

## Context

### 발견 경위
- M9 진입 안 사용자 view 안 회차 삭제 path 부재 사실 (`EpisodeActions.tsx` dormant 단독).
- 단순 `delete().eq(id)` 단독 = cascade 영향 사실 + 본편 episode_number gap 잔존 + works.total_episodes drift.

### 문제 정의
- 회차 삭제 시 (a) cascade 안 부속 데이터 안 자동 손실 사실 + (b) gap 안 후속 등록 안 충돌 잠재 + (c) frozen JSON 안 stale episode_id 잔존 + (d) 동시 분석 race + (e) 재배치 안 race 사실 안 전수 사양 영속화 필수.

---

## Decision

### 결정
- **단일 RPC `delete_episode_and_reorder(p_work_id, p_episode_id)` 단독** = DELETE + 본편 재배치 atomic.
- **본편 = DELETE → PERFORM `reorder_episodes(p_work_id, remaining_ids)`** 안 nested 호출 path.
- **프롤로그 = 단순 DELETE 단독** (재배치 무관, `one_prologue_per_work` partial unique 자동 해제 정합).
- **본편 N=1 마지막 = DELETE + `total_episodes=0` 단독** (재배치 skip).
- **works.total_episodes = 본편 단독 count** (episode_type='episode' filter 사양 영속화).

### 근거
- 단일 RPC 안 atomicity 사실 = 중간 실패 안 rollback 정합 (gap 잔존 race 0).
- nested PERFORM reorder_episodes 안 코드 중복 0 + reorder 본질 재사용 단독.
- 진행 중 분석 잡 차단 (M1 reorder 패턴 답습) + SELECT FOR UPDATE 안 race 차단.

---

## Cascade 손실 매트릭스 (운영 영향 사실 영속화)

### 자동 제거 (ON DELETE CASCADE)
| 테이블 | FK | 사실 |
|---|---|---|
| `analysis_jobs` | `episode_id` | 진행 중 잡 안 자동 제거 (단, RPC 안 차단 정합 안 도달 0 사실) |
| `analysis_results` | `episode_id` | 분석 캐시 안 영구 손실 |
| `analysis_runs` | `episode_id` | **분석 결과 원본 안 영구 손실 사실 ★** (LLM 호출 결과 손실) |
| `episode_memos` | `episode_id` | 메모 안 영구 손실 (최대 1 row/회차) |
| `work_facts` | `episode_id` | **fact 안 영구 손실 사실 ★** (fold 영향 — R-3) |

### Frozen 잔존 사실 (FK 0)
| 테이블 | 사실 | 영향 |
|---|---|---|
| `holistic_analysis_runs.episode_ids[]` (bigint[]) | array 안 FK 사양 불가 | result_json 안 stale episode_id + episode_scores 안 점수 frozen. UI 차트 안 stale 표시 잠재 (backlog 의제 영속화) |
| `holistic_chunk_results.episode_ids[]` | 동일 | 진행 중 chunk 안 stale 잠재 |
| `work_entities.first_seen_episode` (INT, FK 0) | stale `episode_number` 잔존 사실 | read site 0 사실 정합 안 영향 0 (ADR-0030 R-2 정합) |
| `reader_actions` (FK 0) | stale `(work_id, episode_number)` 잔존 | 운영 통계 진입 사양 안 의제 (ADR-0030 R-1 정합) |
| `reports.result_json` (work_id FK) | snapshot 안 frozen | 운영 사양 단독 정합 |

---

## R-3 — work_facts CASCADE 안 fold 영향 trade-off

### 사실
- 본편 회차 삭제 시 = `work_facts` 안 자동 제거 사실.
- 후속 회차 fold 안 = `WHERE episode_number < N` 안 해당 row 제거 후 본질 사실 (`buildWorkContextBlock.ts:189` 영속화).

### 영향
- 후속 회차 분석 안 LLM prompt 안 부속 fact 안 결여 사실 → 분석 결과 안 연속성 갭 잠재.
- 단, `buildWorkContextBlock` 안 fact 0 안 빈 block 반환 사양 정합 (분석 자체 안 fail 0).

### Trade-off
- 본편 삭제 안 frozen 사양 단독 (work_facts 안 stale 잔존) vs CASCADE (현 사양) 안 양면 갭.
- 권고 = **CASCADE 단독** (참조 무결성 우선, 작가 안 명시 삭제 사실 영속화 단독).

---

## Atomicity 사양

### nested PERFORM 패턴
```sql
DELETE FROM episodes WHERE id = p_episode_id;
v_reorder_result := public.reorder_episodes(p_work_id, v_remaining_ids);
IF NOT (v_reorder_result ->> 'ok')::boolean THEN
  RAISE EXCEPTION 'reorder failed after delete: %', v_reorder_result ->> 'error';
END IF;
```

### 트랜잭션 안전 사실
- RAISE EXCEPTION 안 PostgreSQL 안 자동 rollback 정합 → DELETE 자동 복원 사실.
- SECURITY DEFINER 양면 안 동일 owner (postgres) 안 nested 호출 사양 정합.
- `auth.uid()` 안 JWT context 안 보존 사양 → reorder_episodes 안 자체 권한 재검증 단독 (redundant + 안전 정합).

### Q3 의존 사실 영속화
- `reorder_episodes` RPC 안 시그니처 변경 시 = 본 RPC 안 **동반 변경 path 단독 필수**.
- ADR 안 영속화 단독: reorder 본질 변경 시 = delete RPC 안 verify 사양 진입 단독.

---

## 진입점 사양 — 단일 API path

### (가) 편집 모드 — 작품 상세 안 「순서 편집」 모드
- `EpisodeRows.tsx` 안 row 단독 휴지통 button 단독 (위험톤).
- 「편집」 button slot 안 editMode 단독 안 휴지통 단독 교체 사양.
- 프롤로그 행 안 = 삭제 button 노출 사실 (드래그 단독 차단, 삭제 허용 정합).
- busyJobCount > 0 시 button disabled 사양 (M1 정합).

### (나) 에디터 푸터 — `/episodes/[episodeId]/edit`
- footer 우측 안 위험톤 「삭제」 button 단독 (isEdit + episodeId 정합 단독).
- dirty 가드 bypass = isDeleting flag 안 `useAnalysisNavigationGuard(active=false)` 사양.

### 단일 API path 사실
- 양쪽 진입점 안 `POST /api/works/[workId]/episodes/[episodeId]/delete` 단일 호출.
- RPC `delete_episode_and_reorder` 단독 → 응답 분기.

### 응답 사양
| 시나리오 | HTTP status |
|---|---|
| 성공 | 200 |
| user_not_found / forbidden | 403 |
| not_found | 404 |
| analysis_in_progress | 409 |
| 기타 | 400 |
| RPC fail | 500 |

---

## ADR-0031 체크리스트 6 카테고리 적용 결과

### (1) 라벨 — confirm modal + toast 안 라벨 사양
- `episodeNumber === 0 ? "프롤로그" : \`${N}화\`` inline 분기 단독 (M4 C9 패턴 정합).
- modal 안 epLabel + toast 안 동일 사양 단독.

### (2) NAT — 환불 사양
- 본 PR 안 미진입 단독 (환불 path 사실 부재 영속화).

### (3) 실행 — RPC 안 특수 케이스 거부
- `user_not_found` / `forbidden` / `analysis_in_progress` / `not_found` 거부 path 영속화.
- SELECT FOR UPDATE 안 race 차단 + nested PERFORM 안 RAISE EXCEPTION 안 atomicity 단독.

### (4) 정렬 / 재정렬
- 편집 모드 path → `router.refresh()` 안 server fetch 안 자동 갱신.
- 에디터 푸터 path → `router.replace(/works/${workId})` 안 회차 목록 redirect 정합 (M3 C2 패턴).
- 프롤로그 = 재배치 무관 + 일반 모드 안 정렬 자연 위치 단독 (M4 C14 정합).

### (5) Frozen JSON
- `holistic_analysis_runs.result_json.episode_scores` 안 stale episode_id + 점수 frozen 사실 단독.
- UI 차트 안 stale 표시 잠재 사실 = **backlog 의제 영속화 단독** (filter path 미진입 단독).

### (6) 클라 인입 path
- button → confirm modal mount → analysis_runs count fetch (저비용 indexed) → confirm OK → POST API → 응답 분기 → toast / redirect.
- 양쪽 진입점 안 동일 path 단독 (단일 소스 정합).
- modal mount 시 fetch 완료 전 confirm button disabled 단독 (Q6 race 방지 사양 영속화).

---

## 의제 결정 사실 영속화 (STEP 1 정합)

### 다중 선택 삭제 사양 = 미진입 단독
- 본 PR scope 안 단건 단독 path. 향후 의제 단독.

### 커스텀 confirm modal = DeleteWorkButton 패턴 답습
- `window.confirm` 단독 path 안 cascade 손실 메시지 + 위험톤 사실 표현 0 → 커스텀 modal 단독 선택.

### `EpisodeActions.tsx` dormant 안 제거 단독
- 호출처 0 사실 영속화 안 안전 제거 정합.

### confirm 동적 카운트 = `analysis_runs` 단독 표시
- 단일 indexed query 안 저비용 사실 정합.
- `episode_memos` (≤1 row) + `work_facts` (episode_id 인덱스 0) = static 메시지 단독.

### 재배치 안내 문구 = "이후 회차 번호가 당겨집니다"
- "1화부터 재정렬됩니다" 안 중간 삭제 안 오해 사실 잠재 → "당겨집니다" 단독 사양 영속화.

---

## Risks (백로그 영속화)

### R-1 — holistic 차트 안 stale episode_id 사실
- ADR-0031 M4 R-2 정합 단독 영속화.
- UI 안 filter path 미진입 사양 단독 (frozen 사양 정합).
- 처방 = 별도 PR scope 단독 (chart 안 episodes SELECT 안 sync filter path).

### R-2 — `analysis_runs.episode_id` 인덱스 사실
- PostgreSQL 안 FK constraint 안 자동 인덱스 0 사양 영속화.
- LEE Studio 안 `\d+ analysis_runs` 안 사실 검증 의제 영속화.
- 운영 안 분석 누적 사실 시 confirm count fetch 안 Seq Scan 잠재 사실 (단순 작품 안 영향 0).

### R-3 — `work_entities.first_seen_episode` 안 stale 사실
- ADR-0030 R-2 정합 단독.
- read site 0 사양 안 영향 0.

### R-4 — `reader_actions` stale 사실
- ADR-0030 R-1 정합 단독.
- 운영 통계 활성화 진입 사양 안 의제.

### R-5 — 다중 진입점 안 race 사실
- 편집 모드 (가) + 에디터 푸터 (나) 동시 진입 시 = partial unique + SELECT FOR UPDATE 안 자동 직렬화 정합.

---

## Future Work

### holistic 결과 안 stale episode_id filter
- chart point 안 `episodes` SELECT 안 sync 사양 path 단독 (위 R-1).

### 다중 선택 삭제 사양
- 편집 모드 안 체크박스 + 일괄 confirm + 일괄 RPC 단독 (별도 PR).

### `analysis_runs.episode_id` 명시 인덱스 사양
- 운영 안 분석 누적 사실 검증 후 의제 (위 R-2).

---

## Related Commits

- `122282c`: feat(db): delete_episode_and_reorder RPC migration (C1)
- `6a90735`: feat(api): POST /api/works/[workId]/episodes/[episodeId]/delete (C2)
- `a382e78`: feat(episodes): DeleteEpisodeModal 컴포넌트 + cascade 카운트 (C3)
- `3abc873`: feat(episodes): 편집 모드 삭제 버튼 (진입점 가) (C4)
- `84849f3`: feat(episodes): 에디터 푸터 삭제 버튼 (진입점 나) + EpisodeActions 제거 (C5)

---

## Notes

- 운영 적용 순서:
  1. C1 migration = LEE Studio SQL Editor 수동 적용 (CLI 권한 부재 사양 정합).
  2. 적용 후 검증 SQL (함수 정의 + GRANT) 통과 사실 확인.
  3. 코드 (C2~C5 + C6 ADR) main 머지 → Vercel 자동 배포.
  4. 운영 시각 검증 = LEE path (편집 모드 본편 삭제 / 푸터 삭제 / 프롤로그 삭제 / 진행 중 잡 차단 / cascade 손실 사실 / confirm 카운트).
- 본 ADR 안 결정 = 운영 검증 후 갱신 의제 (실측 + 사용자 피드백 영속화).
