# ADR-0006: 알림 읽음 상태 — analysis_jobs.read_at 컬럼 채택 (notifications 테이블 보류)

**Status**: Accepted  
**Date**: 2026-04-24  
**Author**: LEE  
**Implementer**: Claude Code (조사 + 구현)  
**Reviewer**: 웹 Claude (옵션 비교 + EV 분석)  
**Context**: Novel Agent / 헤더 알림 벨 "모두 읽음" 크로스 브라우저 버그  
**Related**: ADR-0003 (어드민 위치), ADR-0005 (useState props 함정)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-24 | 초안 — 버그 발견 + 3가지 옵션 비교 + 옵션 A 채택 |

---

## 1. Context (배경)

### 발견된 버그
헤더 벨 아이콘 알림 시스템에서 "모두 읽음" 동작 불일치:

| 현상 | 상태 |
|-----|-----|
| "모두 읽음" 클릭 | ✅ 배지 0 으로 즉시 변경 |
| 같은 탭 내 새로고침 | ✅ 배지 0 유지 |
| **다른 브라우저/기기 접속** | ❌ **배지 다시 "9+" 로 복귀** |

### 원인
구현 조사 결과:
- `mark-all-read` API 가 `analysis_jobs.id` 목록만 반환
- 클라이언트가 `sessionStorage` (`ohb_analysis_read_job_outcomes`) 에 저장
- `sessionStorage` = 같은 탭/세션에서만 유효
- → 다른 브라우저/기기에는 **읽음 상태 전파 불가능**

### 코드 주석에 명시된 의도
```
"모두 읽음"은 현재 클라이언트(sessionStorage) 기반이라 DB에 read 플래그를 
저장하지 않습니다. 대신 서버가 "해당 유저의 결과(outcome) job id 목록"을 
반환하고, 클라이언트가 이를 readOutcomeJobIds에 반영해 UI를 일괄 읽음 
처리합니다.
```

→ **버그 아닌 의도적 MVP 타협**. "현재" 라는 단서어가 과도기적 뉘앙스.

### 제약
- 1인 운영, 베타 단계
- 기존 알림 인프라: `analysis_jobs` 단일 테이블 ("분석 작업 = 알림" 모델)
- 향후 비분석 알림 (댓글, 공지 등) 발생 가능성 미정

---

## 2. Decision (결정)

**옵션 A 채택**: `analysis_jobs` 테이블에 `read_at TIMESTAMPTZ` 컬럼 추가.

### 구체 구현
```sql
ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_unread
  ON public.analysis_jobs(app_user_id, updated_at DESC)
  WHERE read_at IS NULL;

COMMENT ON COLUMN public.analysis_jobs.read_at IS
  '헤더 알림 벨에서 "모두 읽음" 처리된 시각. NULL 이면 유저가 아직 안 읽음.
  completed/failed 최상위 job 대상으로만 세팅됨.';
```

### 변경 사항
- `mark-all-read` API: SELECT → UPDATE (read_at = NOW()) RETURNING id
- `outcomes` API: SELECT 에 read_at 컬럼 추가
- `AnalysisJobsContext`: sessionStorage 제거, 서버 응답의 read_at 기반 동기화
- 응답 포맷 `{ job_ids: [...] }` 유지 (클라이언트 호환)

---

## 3. Alternatives Considered

### 옵션 A — analysis_jobs.read_at 추가 ⭐ 채택

**장점**:
- 최소 침습 (DB 컬럼 1개 + 4파일 수정)
- 기존 "analysis_jobs = 알림 소스" 멘탈 모델 유지
- 크로스 브라우저 일관성 확보
- 부분 인덱스로 성능 최적화 (read_at IS NULL 만 인덱싱)

**단점**:
- analysis_jobs 가 "작업 상태" + "알림 읽음 상태" 겸함 (개념적 오염)
- 비분석 알림 (댓글/공지) 추가 시 구조 재설계 필요

### 옵션 B — notifications 테이블 신설

```sql
CREATE TABLE public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(auth_id),
  type TEXT NOT NULL,
  ref_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**장점**:
- 알림이 도메인 객체로 독립 → 향후 확장성 (댓글/공지/이벤트 등)
- CLAUDE.md 의 "주요 DB 테이블" 에 이미 notifications 명시 → 본래 의도 복원
- 알림 타입별 분리 가능

**단점**:
- 6~8 파일 수정, 4~6시간 작업
- 분석 파이프라인 (worker, pipeline_events) 까지 수정 필요
- CLAUDE.md "건드리면 안 되는 곳" (소비자 사이트 분석 파이프라인) 일부 침범
- outcome 쿼리와 notifications 의 관계 정리 필요 (중복 데이터 소스)
- MVP 단계에 오버엔지니어링

### 옵션 C — sessionStorage → localStorage 전환

```typescript
// 단순 한 줄 변경
const readJobIds = JSON.parse(localStorage.getItem(KEY) || '[]');
```

**장점**:
- 1 파일 / 10분 작업
- DB 스키마 무수정

**단점**:
- 다른 브라우저/기기 동기화 **여전히 안 됨** (LEE 의 핵심 증상 미해결)
- 같은 PC 내 편의성만 개선
- **반쪽 해결**

---

## 4. EV Analysis

> 공식: **E = P(win) × Gain − P(loss) × Loss**

### 옵션 A — analysis_jobs.read_at ⭐
```
P(win)  = 0.9
근거:   DB 컬럼 추가 = 검증된 패턴, 실수 여지 최소

Gain:
- 1~2시간 작업으로 근본 해결
- 부분 인덱스로 성능 영향 0
- 기존 데이터 모델 유지

Loss:
- 개념적 오염 (소)
- 추후 비분석 알림 추가 시 옵션 B 로 승격 필요

EV ≈ 강한 양수
```

### 옵션 B — notifications 신설
```
P(win)  = 0.8
근거:   분석 파이프라인 수정 위험, 범위 큼

Gain:
- 장기 확장성
- 도메인 모델 깔끔

Loss:
- 4~6시간 작업
- 일회성 예외 권한 범위 초과 (CLAUDE.md 금지 영역)
- 중복 데이터 소스 정리 부담

EV ≈ 중간 양수 (이번 작업엔 과함)
```

### 옵션 C — localStorage 전환
```
P(win)  = 0.5
근거:   기술적 변경 단순, 근데 문제 본질 미해결

Gain:
- 즉시 효과
- 같은 PC 편의성

Loss:
- 다른 브라우저/기기 동기화 안 됨 (= 버그 절반만 해결)
- 추후 또 옵션 A/B 로 가야 함 = 이중 작업

EV ≈ 약한 양수
```

### 비교

| 옵션 | EV | P(win) | 작업 규모 | 근본 해결 |
|-----|----|--------|---------|---------|
| **A read_at 컬럼** | **강한 양수** | **0.9** | **1~2시간** | **✅** |
| B notifications 신설 | 중간 양수 | 0.8 | 4~6시간 | ✅ |
| C localStorage | 약한 양수 | 0.5 | 10분 | ❌ |

---

## 5. Revisit Criteria

이 결정을 재검토할 조건 (옵션 B 로 승격):

### 옵션 B 로 승격 트리거
- **비분석 알림 도입**:
  - 댓글 알림 (작가 ↔ 작가 / 작가 ↔ 운영자)
  - 공지사항 알림
  - 이벤트/프로모션 알림
  - 결제/환불 처리 알림 (Paddle 도입 후)
- **알림 종류 3개 이상 누적**:
  - analysis_jobs 의 read_at 컬럼이 다른 알림 타입 못 표현
- **CS 담당자 영입**:
  - 알림 운영 대시보드 필요
  - 통계/분류 기능 = notifications 테이블 정규화 우위

### 현재 상태
- 알림 = 분석 결과 1종류
- 1인 운영
- → **옵션 A 가 최적**

---

## 6. Consequences

### Positive
- 어제 운영 이슈 (다른 브라우저 배지 재등장) 즉시 해결
- 1~2시간 작업으로 근본 해결
- 부분 인덱스로 쿼리 성능 ↑ (read_at IS NULL 만 스캔)
- ADR 시리즈에 **버그 진단 → 옵션 비교 → EV 채택** 패턴 6번째 적용

### Negative
- `analysis_jobs` 가 "작업 상태" + "알림 읽음" 겸함
- 개별 알림 클릭 읽음 (`markJobOutcomeRead`) 은 여전히 local 상태 (P2-006 후보)
- 비분석 알림 도입 시 옵션 B 로 마이그레이션 필요

### Neutral
- 응답 포맷 (`{ job_ids: [...] }`) 유지로 클라이언트 호환성 무영향
- 마이그레이션 idempotent (`IF NOT EXISTS`) → 재실행 안전

---

## 7. Open Questions

- **개별 알림 클릭 읽음** 처리: 현재 클라이언트 local Set 만 업데이트. DB 동기화 필요?
  → 답: 빈도 낮고 우선순위 낮음. P2-006 으로 backlog 등록 (필요 시).
- **알림 만료 정책**: 7일 이상 지난 read_at 컬럼 가비지 컬렉션 필요?
  → 답: 현재 7일 필터링이 outcomes API 에서 적용됨. 별도 GC 불필요.
- **여러 admin 동시 운영 시**: read_at 이 마지막 admin 의 시각으로 덮어쓰임?
  → 답: 현재 단일 사용자 (자기 자신만 읽음 처리) 전제. 다중 admin 도 영향 없음.

---

## 8. Implementation Notes

### 작업 분할 (Claude Code 자율 진행)
```
Step 1: 마이그레이션 작성 (파일만, LEE 수동 실행)
Step 2: mark-all-read API → UPDATE 로 변경
Step 3: outcomes API → read_at 컬럼 select 추가
Step 4: AnalysisJobsContext → sessionStorage 제거
Step 5: 빌드 검증 + 커밋
```

### 마이그레이션 실행 순서 (중요)
```
1. Supabase 콘솔에서 마이그레이션 실행 (LEE 수동)
   → DB 에 read_at 컬럼 생성됨
2. 로컬 npm run dev 로 테스트
3. 통과 후 git push
   → Vercel 자동 배포
   → 라이브 코드 ↔ DB 스키마 동기화

⚠️ 순서 어기면: 코드는 read_at 사용하려는데 DB 에 컬럼 없음 → 500 에러
```

### 검증 시나리오
- 브라우저 A: "모두 읽음" 클릭 → 배지 0
- 브라우저 B (시크릿 창): 같은 계정 로그인 → **배지 0 유지**
- 새 분석 완료 → 양쪽 다 배지 +1

→ 검증 통과 (2026-04-24 기준).

---

## 9. Lessons Learned

### 기술적 교훈
1. **MVP 타협의 흔적은 명확히 표시**:
   - 코드 주석에 "현재" 같은 단서어 → 미래 개선 신호
   - 근데 시간 지나면 잊힘 → ADR 로 기록 필수

2. **sessionStorage 의 함정**:
   - 같은 탭/세션 한정 = 사실상 휘발성
   - "유저별 동기화" 가 필요한 데이터엔 부적합
   - localStorage 도 마찬가지 (PC별 분리)
   - **DB 가 유일한 진실 (single source of truth)**

3. **부분 인덱스의 위력**:
   - `WHERE read_at IS NULL` 부분 인덱스
   - 읽지 않은 알림만 검색하는 쿼리 패턴에 최적
   - 일반 인덱스 대비 크기/성능 ↑

### 진단 교훈
```
증상: UI 만 안 됨 (다른 브라우저)
확인 순서:
1. 브라우저 A 동작 → 정상 (UI 즉시 반영)
2. 다른 브라우저 → 안 됨 (DB 동기화 안 된 신호)
3. Network 탭 → mark-all-read 요청 정상 응답
4. 응답 형태 → job_ids 배열만 (UPDATE 흔적 없음)
5. 코드 조사 → sessionStorage 발견
6. 결론: 의도적 MVP 타협, 근본 수정 필요
```

→ **"증상 위치 = 원인 위치 가설"**. 어디까지 정상이고 어디부터 안 되는지 좁힐 것.

### 협업 교훈 (Claude Code 와의 상호작용)
- Claude Code 가 "의도적 설계 vs 미완성" 구분 위해 **코드 주석까지 분석**
- 옵션 3개를 EV 와 함께 제시 → LEE/웹 Claude 가 **선택만**
- 자율 진행 권한 부여 후 **8 파일 수정 + 빌드 + 커밋** 까지 1시간 내 완료

→ "조사 → 옵션 → 선택 → 실행" 흐름 5번째 검증.

### 포트폴리오 가치
면접 답변 소재:
> "1인 운영 SaaS 의 알림 시스템에서 sessionStorage 기반 MVP 타협을 발견하고, 
> 다른 브라우저 동기화 안 되는 버그를 진단했어요. 
> 옵션 3개 (컬럼 추가 / 신규 테이블 / localStorage 전환) 를 EV 분석으로 비교하고, 
> 1인 운영 규모와 알림 종류 (분석 1종) 를 근거로 컬럼 추가 옵션을 채택했어요. 
> 4파일 / 1~2시간 작업으로 근본 해결하면서, 비분석 알림 도입 시 notifications 
> 테이블로 승격하는 트리거 조건도 ADR 에 기록해뒀어요."

---

## Appendix A: ADR 시리즈 진화 (6번째)

| ADR | 영역 | 감 vs EV | 옵션 수 | 채택 옵션 |
|-----|------|---------|--------|---------|
| 0001 NAT 모델 | 비즈니스 | 감 = EV | 3 | A |
| 0002 통합 저장 v2 | 기술 | 감 = EV | 2 | A (Promise.allSettled) |
| 0003 어드민 위치 | 기술 | 감 ≠ EV | 3 | A (서브도메인 거부) |
| 0004 패들 시점 | 비즈니스+법무 | 감 = EV | 4 | C |
| 0005 useState props | 기술 버그 | 감 = EV | 3 | A (key 리마운트) |
| **0006 알림 read_at** | **기술 버그** | **감 = EV** | **3** | **A** |

→ EV 프레임이 **버그 수정 + 아키텍처 결정** 양쪽 모두 적용 가능 검증.

특히 ADR-0005, 0006 연속해서 **"버그 수정도 ADR 자산화 가능"** 사례 축적.

---

## Appendix B: 알림 시스템의 미래 (notifications 테이블 시점)

옵션 B 로 승격할 때 미래 ADR 후보:

```
ADR-XXXX: notifications 테이블 도입 — analysis_jobs.read_at 마이그레이션

배경: 댓글 알림 / 공지사항 추가로 비분석 알림 발생
결정: notifications 테이블 신설, 기존 read_at 컬럼 → 통합 마이그레이션

마이그레이션 전략:
1. notifications 테이블 생성
2. 기존 analysis_jobs.read_at 데이터 → notifications 행 변환
3. 분석 완료 트리거를 notifications INSERT 로 변경
4. analysis_jobs.read_at 컬럼 deprecate (즉시 삭제 안 함, 점진 제거)
5. 클라이언트가 notifications 만 사용하도록 전환
```

→ 이번 ADR-0006 의 "기술 부채 인수증" 역할.

---

**End of ADR-0006 v1.**
