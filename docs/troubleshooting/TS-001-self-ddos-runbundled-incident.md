# TS-001: self-DDoS + runBundled 비대칭 + maxDuration timeout 복합 사고

## 메타

| 항목 | 내용 |
|---|---|
| 발생일 | 2026-05-02 ~ 2026-05-03 |
| 영향 범위 | 5~10화 일괄 분석 (single_call 경로) |
| 영향 기간 | 2026-04-12 ~ 2026-05-03 (약 2~3주) |
| 해결 시간 | 16시간 (감지 → 처방 배포) |
| 심각도 | High (사용자 분석 사실상 중단 + DB 부하 임계) |
| 후속 ADR | [ADR-0012](../adr/ADR-0012-remove-runbundled-from-holistic-batch.md), [ADR-0013](../adr/ADR-0013-external-system-load-baseline.md) |

---

## 증상

- **5화 일괄 분석이 멈춤**: 사용자가 5화 선택 → 5~14분 후 timeout, 결과 미생성
- **`holistic_pipeline_events` 테이블에 `batch_start` 이벤트만 기록**, `single_model_result`/`completed` 없음
- **`analysis_jobs`에 좀비 row 누적**: status=`processing` 상태로 12분 hard expire 시까지 잔류
- **DB 부하 비정상**: 시간당 22,694 쿼리 (정상 베이스라인 대비 약 5~10배)
- **Vercel function logs**: `/api/analyze/process` 가 maxDuration 초과로 종료되는 패턴 반복

---

## 발견 경위

2026-05-02 16:00 KST, 본인이 production 모니터링 중 Supabase usage dashboard에서 비정상 부하 감지. 동시에 사용자 1명으로부터 "5화 분석이 안 끝나요" 문의 1건.

→ 단순 LLM 지연이 아니라 시스템 차원의 회귀라고 직감.

---

## 가설 변천사

진단 과정에서 6개 가설을 거쳤다. 잘못된 가설을 빨리 폐기하는 것이 핵심이었다.

### 1차: 라우팅 버그 (폐기)
- 가설: `/api/analyze` → `/api/analyze/process` 라우팅이 끊겼다
- 검증: Vercel function logs에서 process 함수 호출 자체는 들어옴
- 폐기 근거: 라우팅은 정상, 함수 내부에서 timeout

### 2차: Supabase 인프라 장애 (폐기)
- 가설: Supabase 측 realtime/postgres 일시 장애
- 검증: Supabase status page 정상, 다른 쿼리는 정상 응답
- 폐기 근거: 우리 쪽 트래픽만 비정상

### 3차: self-DDoS — `syncAppUser` (확정 RC#1)
- 가설: 매 요청마다 `users` 테이블에 쓸데없는 UPDATE 발생
- 검증: 시간당 12,734건 UPDATE, 대부분 변경 없는 동일 값으로 덮어쓰기
- 확정: `syncAppUser` 함수가 변경 여부 체크 없이 무조건 UPSERT 실행

### 4차: 폴링 fan-out (확정 RC#2)
- 가설: 클라이언트 폴링이 다중 hotspot에서 폭주
- 검증: 분석 1건당 약 1,500 쿼리 발생 (정상 ~300)
- 확정: 3개 hotspot에서 동시 polling — 작품 목록, 작품 상세, 분석 페이지

### 5차: maxDuration timeout (확정 RC#3 일부)
- 가설: Vercel function maxDuration이 LLM 처리 시간보다 짧다
- 검증: 5화 처리 시간 7분 17초 vs Vercel maxDuration 5분
- 확정: timeout으로 함수 강제 종료 → analysis_jobs 좀비 잔류

### 6차: `runBundled` 알고리즘 비대칭 (확정 RC#3 본질)
- 가설: 5/10화 일괄 분석에서 LLM 호출 횟수가 의도보다 많다
- 결정적 단서: `holistic_pipeline_events.single_model_result` 이벤트가 **2026-04-15 이후 0건**
- 검증: `runBundled` 도입(4/12) 후 LLM이 회차 5회 + 통합 1회 = **6배 호출**
- 확정: chunk 경로(10화 단위 배치)는 단일 호출인데 single_call 경로만 비대칭

---

## 결정적 단서

`holistic_pipeline_events.single_model_result` 이벤트가 2026-04-15 이후 0건.

→ **회귀 시점 정확 식별**: 4/12 `runBundled` 도입 commit(`f3da440`)이 4/15부터 모든 single_call 경로에서 활성화됨.

이벤트 로그 테이블이 없었다면 "최근 2~3주간 어딘가 이상하다" 수준에서 멈췄을 것. 정확한 회귀 commit 식별이 가능했던 핵심.

---

## Root Causes

### RC#1: `syncAppUser` 무조건 UPDATE
- **현상**: 시간당 12,734건의 users 테이블 UPDATE
- **원인**: `syncAppUser` 함수가 변경 여부 검사 없이 매 요청마다 UPDATE 실행
- **영향**: DB connection pool 점유, replication lag, WAL 부하

### RC#2: 폴링 fan-out 폭주
- **현상**: 분석 1건당 약 1,500 쿼리 발생
- **원인**: 3개 hotspot(작품 목록, 작품 상세, 분석 페이지)에서 독립적 polling 동시 실행
- **영향**: 사용자 1명이 분석 페이지 열면 3중 polling으로 부하 증폭

### RC#3: `runBundled` 비대칭 + maxDuration mismatch
- **현상**: 5화 일괄 분석 시 LLM 6회 호출, 처리 시간 7분 17초
- **원인**:
  - 4/12 `runBundled` 도입 commit `f3da440`에서 single_call 경로에 회차별 LLM 추가 호출 로직이 들어감
  - chunk 경로(10화 단위)는 단일 호출 유지 → **경로 간 비대칭**
  - Vercel maxDuration 5분 < 처리 시간 7분 → timeout
- **영향**: 5/10화 분석 사실상 불가, analysis_jobs 좀비 누적

---

## 처방

### 처방 1: `syncAppUser` 변경 감지 추가 (RC#1)
변경된 필드만 UPDATE 하도록 수정. 무변경 시 SQL 발행 안 함.

### 처방 2: 폴링 fan-out 단일화 (RC#2)
`AnalysisJobsContext`에서 단일 realtime 구독 + 폴링 1곳으로 통일. 페이지별 독립 polling 제거.

### 처방 3: maxDuration 상향 + 내부 상한 (RC#3 일부)
- `/api/analyze/process` maxDuration 300초로 상향 (Vercel Pro 한계)
- 내부 상한 600~800초로 graceful timeout 처리
- 12분 hard expire는 유지

### 처방 4: `runBundled` 제거 (RC#3 본질) — [ADR-0012](../adr/ADR-0012-remove-runbundled-from-holistic-batch.md)
- `runBundledEpisodesForHolisticSelection` 호출 제거
- `runEpisodeAnalysisBundledInHolistic.ts` 파일 삭제
- 회차별 데이터는 `syncPerEpisodeAnalysisFromHolisticRun`의 derive로 충당
- 결정 근거는 ADR-0012 참조

---

## 검증

### 직후 검증 (2026-05-03)
- 5화 일괄 분석 1~2분 내 정상 완료 (이전 7분+ → timeout)
- `holistic_pipeline_events.single_model_result` 이벤트 재기록
- 분석 1건당 쿼리 1,500 → 400 (74% 감소)
- `analysis_jobs` 좀비 row 신규 발생 0건

### 24시간 후 모니터링 (2026-05-04)
- DB 부하 베이스라인 회복
- 사용자 분석 성공률 정상 복귀

---

## 교훈

### 1. 이벤트 로그 테이블의 가치
`holistic_pipeline_events`가 없었다면 회귀 시점(4/12) 식별이 불가능했을 것. **알고리즘 분기점마다 이벤트를 적재하는 비용은 낮고, 사고 시 ROI가 폭발적이다.** 향후 새 분석 경로 추가 시 이벤트 로깅을 의무화.

### 2. 의도 vs 코드 mismatch (`5ccc749`)
commit `5ccc749`의 메시지는 "runBundled 제거 상태 유지" 의도였으나 실제 코드는 `runBundled` 호출이 살아있었다. **commit message가 사실을 보장하지 않는다.** PR diff 리뷰 + 사후 검증 절차 필요.

### 3. 사용자 직감 신뢰
"AWS daily report 때문 아닐까" 같은 본인 직감이 결과적으로 정확했다(ADR-0013 참조). **비개발자 운영자의 도메인 직감은 종종 데이터보다 빠르다.** 직감을 가설로 즉시 검증하는 워크플로 유지.

### 4. 1차 hotfix 후 회귀 위험
처방 1~3 배포 후 네이버 로그인이 잠시 깨졌다(별도 hotfix). **hotfix는 인접 기능에 회귀를 부른다.** smoke test 체크리스트 필요.

### 5. 가설 하나에 매달리지 않기
1차/2차 가설을 빨리 폐기하지 못했다면 진단이 며칠 더 걸렸을 것. **가설별 검증 비용을 먼저 추정하고 싼 것부터 친다.**

### 6. Vercel deploy ≠ git push
`git push` 후 Vercel 빌드 실패로 production이 이전 버전으로 남아있던 시간이 있었다. **deploy 성공 여부를 push와 별개로 확인.**

---

## 후속 작업

### 즉시 (D+0 ~ D+1)
- [x] 처방 1~4 배포
- [x] `single_model_result` 이벤트 재기록 모니터링
- [x] 좀비 analysis_jobs cleanup 완료

### 단기 (D+1 ~ D+7)
- [x] [ADR-0012](../adr/ADR-0012-remove-runbundled-from-holistic-batch.md) 작성
- [x] [ADR-0013](../adr/ADR-0013-external-system-load-baseline.md) 작성
- [ ] realtime cleanup 보강 (좀비 채널 방지) — 별도 작업 진행 중
- [ ] smoke test 체크리스트 정의 (네이버 로그인 회귀 케이스 포함)

### 중기 (D+7 ~ D+30)
- [ ] 운영 dashboard에 시간대별 베이스라인 표시 (ADR-0013 후속)
- [ ] 이벤트 로깅 가이드라인 문서화 (어떤 분기점에 무엇을 적재할지)
- [ ] 분석 파이프라인 통합 부하 테스트 시나리오 (5/10/30화)

### 정책
- 새 분석 경로 추가 시 PR 템플릿에 "이벤트 로깅 추가 여부" 체크박스
- chunk 경로 vs single_call 경로 동작 동등성을 회귀 테스트로 보장

---

## 진단에 사용한 SQL

### 회귀 시점 식별 (single_model_result 이벤트 끊김)
```sql
SELECT date_trunc('day', created_at) AS day, count(*)
FROM holistic_pipeline_events
WHERE event_type = 'single_model_result'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;
```

### syncAppUser self-DDoS 확인
```sql
SELECT date_trunc('hour', updated_at) AS hour, count(*)
FROM users
WHERE updated_at > now() - interval '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

### 좀비 analysis_jobs 식별
```sql
SELECT id, work_id, status, created_at, updated_at,
       extract(epoch from (now() - updated_at))/60 AS stale_minutes
FROM analysis_jobs
WHERE status = 'processing'
  AND updated_at < now() - interval '12 minutes'
ORDER BY updated_at;
```

### 분석 1건당 쿼리 수 추정 (pg_stat_statements)
```sql
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%analysis_jobs%'
   OR query ILIKE '%episodes%'
ORDER BY calls DESC
LIMIT 20;
```

---

## Related

- 처방 1~3 commit: `6d633c5` (fix(analysis): self-DDoS + maxDuration timeout + 폴링 fan-out 종합 처방)
- 처방 4 commit: `9fd23f3` (refactor(analysis): runBundled 제거)
- 회귀 commit: `f3da440` (4/12 runBundled 도입)
- mismatch commit: `5ccc749` (의도와 코드 불일치)
