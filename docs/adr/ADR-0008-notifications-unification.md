# ADR-0008: 알림 시스템 통합 + 사이트 내 1:1 문의 답변 (notifications 테이블 도입)

**Status**: Accepted  
**Date**: 2026-04-25  
**Author**: LEE  
**Implementer**: Claude Code (구현 예정)  
**Reviewer**: 웹 Claude (설계)  
**Context**: Novel Agent / 1:1 문의 시스템 메일 → 사이트 내 답변으로 전환 + ADR-0006 옵션 B 승격  
**Related**: ADR-0006 (알림 read state), ADR-0007 (Phase 2 회고)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-25 | 초안 — notifications 테이블 도입 + 알림 통합 설계 |

---

## 1. Context (배경)

### 트리거 이벤트
2026-04-25 어드민 MVP 마지막 페이지 (문의 관리) 작업 중,
LEE 가 "메일 발송 방식이 올드함, 사이트 내 답변 + 알림 시스템 통합" 요구.

### ADR-0006 의 예약된 트리거
ADR-0006 (analysis_jobs.read_at) 의 Revisit Criteria:
> "비분석 알림 도입 (댓글 알림, 공지사항 알림, 결제/환불 알림 등)"

→ **1:1 문의 답변 알림 = 비분석 알림**. ADR-0006 의 옵션 B 승격 트리거 발동.

### 현재 알림 시스템 구조
- analysis_jobs.read_at 컬럼 기반 (ADR-0006)
- 헤더 벨 아이콘에 "분석 완료/실패" 알림 표시
- "모두 읽음" → DB UPDATE
- 크로스 브라우저 동기화 (4/24 검증 완료)

### 현재 1:1 문의 시스템
- `/api/contact/inquiry/route.ts`: Resend 메일 발송만
- DB INSERT 없음
- 답장 추적 = LEE 의 Gmail 별표/라벨

### 문제
1. **답장 누락 위험** (메모리 기록): 같은 유저에게 두 번 답장 발생 사례
2. **현대 SaaS 표준 어긋남**: Linear, Intercom 등 대부분 사이트 내 답변
3. **알림 시스템 분리**: analysis_jobs 만 보는 구조 → 확장성 0

---

## 2. Decision (결정)

### 2-1. notifications 테이블 신설

```sql
CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          text NOT NULL,           -- 'analysis' | 'inquiry_reply' | 미래 확장
  ref_id        text NOT NULL,           -- analysis_jobs.id 또는 inquiries.id (text 로 통일)
  title         text NOT NULL,           -- 알림 제목 (UI 표시용)
  body          text,                    -- 부가 설명 (옵션)
  link_url      text,                    -- 클릭 시 이동 경로
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

-- RLS: 본인 알림만 SELECT, service_role 만 INSERT/UPDATE
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO service_role;
```

### 2-2. inquiries 테이블 확장

```sql
CREATE TABLE public.inquiries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       bigint REFERENCES public.users(id) ON DELETE SET NULL,
  user_auth_id  uuid,
  title         text NOT NULL,
  content       text NOT NULL,
  reply_email   text NOT NULL,            -- 백업용 (메일 알림 시점 검토용)
  reply_content text,                     -- 어드민 답변 본문 (NEW)
  replied_at    timestamptz,
  replied_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**핵심 변경**: `reply_content` 컬럼 추가. 어드민 답변이 DB 저장됨.

### 2-3. analysis_jobs.read_at 마이그레이션 전략

**옵션 X (선택)**: 이중 운영 → 점진 마이그레이션

```
Phase 1 (이번 ADR-0008):
- notifications 테이블 신설
- 신규 알림 (inquiry_reply) → notifications 사용
- analysis_jobs.read_at 그대로 유지 (legacy 알림 소스)
- 헤더 벨 = analysis_jobs + notifications 양쪽 조회 후 합쳐서 표시

Phase 2 (미래 ADR):
- analysis 완료 시점에 notifications 도 INSERT (병행)
- 일정 기간 후 analysis_jobs.read_at 사용 중단
- 최종적으로 notifications 만 조회
```

**왜 점진?**
- 기존 라이브 알림 동작 보장 (회귀 위험 0)
- Phase 1 만으로 inquiry 답변 알림 가치 즉시 확보
- analysis 알림은 나중에 천천히 마이그레이션

### 2-4. 1:1 문의 폼 핸들러 변경

**기존**:
```typescript
// /api/contact/inquiry/route.ts
await resend.emails.send({...});  // 메일만 발송
```

**변경**:
```typescript
// /api/contact/inquiry/route.ts
await supabase.from('inquiries').insert({...});  // INSERT 먼저
// 메일 발송 제거 (또는 백업용 옵션)
```

**메일 발송 제거 이유**:
- 어드민에서 답변 작성 → notifications 알림 발송으로 충분
- 메일 + 알림 이중 발송 = 노이즈

---

## 3. Alternatives Considered

### 옵션 A — analysis_jobs.read_at 만 유지 (현상 유지)
- 1:1 문의는 별도 시스템
- → 알림 분산, ADR-0006 옵션 B 승격 미발동
- **EV: 약한 양수** (단기 OK, 장기 비효율)

### 옵션 B — notifications 신설 + analysis 즉시 마이그레이션
- analysis_jobs.read_at 즉시 deprecate
- 모든 알림 notifications 로
- **단점**: 회귀 위험 ↑ (라이브 알림 시스템 갈아엎기)
- **EV: 양수** (이상적이나 위험)

### 옵션 X — 점진 마이그레이션 (이번 채택) ⭐
- notifications 신설 (신규 알림용)
- analysis_jobs.read_at 그대로 (legacy)
- 헤더 벨 = 양쪽 조회 통합
- **EV: 강한 양수** (회귀 위험 ↓ + 신규 가치 즉시)

### 옵션 D — 메일 알림 유지 + DB 추적
- 답변 메일 발송 + DB INSERT
- 알림 시스템 변경 없음
- **단점**: LEE 가 거부 (메일 = 올드)
- **EV: 약한 양수**

---

## 4. EV Analysis

### 옵션 X (점진 마이그레이션) ⭐
```
P(win)  = 0.85
근거: 기존 라이브 회귀 0, 신규 가치 즉시

Gain:
- inquiry 답변 알림 즉시 (헤더 벨 통합)
- ADR-0006 옵션 B 승격 (계획대로 진화)
- 미래 알림 (결제, 공지) 추가 쉬움
- analysis 마이그레이션은 별도 ADR (천천히)

Loss:
- 일정 기간 이중 운영 (analysis_jobs.read_at + notifications 둘 다 조회)
- 헤더 벨 통합 로직 복잡도 ↑

EV ≈ 강한 양수
```

### 옵션 B (즉시 전체 마이그레이션)
```
P(win)  = 0.65
근거: 라이브 회귀 위험 (분석 알림 망가짐)

Gain:
- 깔끔한 단일 시스템
- 코드 복잡도 ↓

Loss:
- 마이그레이션 데이터 이전 작업 (existing read_at → notifications.read_at)
- 회귀 시 디버깅 어려움
- 작업 시간 +3~4시간

EV ≈ 양수 (X 보다 낮음)
```

---

## 5. Implementation Roadmap

### Phase 1 (이번 작업, 6시간 한계)

#### Step 1: 마이그레이션 + 어드민 답변 UI (커밋 1)
파일:
- `supabase/migrations/{ts}_notifications.sql` (신규)
- `supabase/migrations/{ts}_inquiries.sql` (신규)
- `src/lib/admin/inquiryQueries.ts` (신규)
- `src/lib/admin/types.ts` (수정)
- `src/app/api/admin/inquiries/route.ts` (신규, GET 목록)
- `src/app/api/admin/inquiries/[id]/route.ts` (신규, PATCH 답변)
- `src/app/admin/inquiries/page.tsx` (신규)
- `src/components/admin/InquiriesListView.tsx` (신규)

LEE 수동:
- Supabase 콘솔에서 마이그레이션 2개 실행
- 로컬 dev 재시작

#### Step 2: 컨슈머 영역 + 알림 통합 (커밋 2 + 3)
일회성 예외 권한 영역:
- `src/app/api/contact/inquiry/route.ts` (수정 — 메일 → INSERT)
- `src/app/account/inquiries/page.tsx` (신규 — 유저 문의함)
- 헤더 벨 통합 로직 (소비자 사이트 알림 컴포넌트)

분리:
- 커밋 2: 컨슈머 폼 + 문의함 페이지
- 커밋 3: 헤더 벨 통합 (analysis_jobs + notifications 양쪽 조회)

#### Step 3: 빌드 + 회귀 테스트
- `npm run build`
- 로컬 시나리오:
  - 기존 분석 알림 정상 (배지 카운트, "모두 읽음")
  - 새 1:1 문의 작성 → DB 저장 → 어드민에서 답변 → 알림 발생
  - 알림 클릭 → 문의함 이동
- Push

### Phase 2 (미래 ADR)
- analysis 완료 시 notifications INSERT 추가
- 일정 기간 후 analysis_jobs.read_at deprecate
- 헤더 벨 단일 소스화

---

## 6. Consequences

### Positive
- 1:1 문의 답장 누락 위험 0 (DB 추적)
- 현대 SaaS 답변 흐름 (사이트 내)
- 알림 통합 인프라 마련 → 미래 알림 추가 쉬움
- ADR-0006 의 계획적 진화

### Negative
- 일시적 이중 운영 (analysis_jobs.read_at + notifications)
- 헤더 벨 통합 쿼리 복잡도 ↑ (UNION 또는 양쪽 fetch)
- 컨슈머 사이트 일회성 예외 권한 범위 확대
- 6시간 작업 (오늘 컨디션 한계)

### Neutral
- Phase 2 마이그레이션은 별도 ADR (당장 필요 없음)
- 기존 메일 발송 로직 제거 (백업 정책 미정 — Open Question)

---

## 7. Open Questions

### Q1: 메일 발송 완전 제거 vs 백업 유지
**현재 결정**: 완전 제거 (LEE 의지)
**대안**: 답변 알림 발송 시 메일도 함께 발송 (이중 알림)
**보류 이유**: 알림 시스템 신뢰 충분하면 메일 불필요. 신뢰 부족 시 추가.

### Q2: 헤더 벨 통합 방식
**옵션 a**: 클라이언트에서 양쪽 fetch 후 합치기 (단순, 비효율)
**옵션 b**: 백엔드 API 에서 UNION 쿼리 (복잡, 효율)
**현재 권장**: 옵션 a (구현 빠름, 6시간 한계 고려)

### Q3: notifications 의 type enum vs free text
**현재**: text (자유)
**대안**: enum 제약 (CHECK)
**보류 이유**: 미래 알림 종류 예측 불가. 자유로 두고 코드에서 일관 관리.

---

## 8. Revisit Criteria

### Phase 2 진입 조건
- analysis_jobs.read_at 사용 코드가 명확히 격리됨
- notifications 가 안정 운영 (1개월+)
- analysis 완료 알림도 notifications 로 옮겨도 회귀 없음 확신

### 다른 알림 종류 추가 시점
- 결제 완료/실패 알림 (Paddle 도입 후)
- 공지사항 (대규모 베타 진입 후)
- 작가 ↔ 작가 상호작용 (P3 수준)

→ 각 알림 종류 추가 시 미래 ADR (별도)

---

## 9. Lessons Learned (사전)

이 ADR 은 구현 전 작성. 사후 회고는 ADR-0009 (또는 별도) 에서.

### 사전 학습
1. **ADR-0006 의 Revisit Criteria 가 정확히 작동**
   - "비분석 알림 도입 시" 트리거가 실제 발동
   - 미래 ADR 작성 시 Revisit Criteria 가치 확인됨

2. **점진 마이그레이션의 ROI**
   - 옵션 B (즉시) vs 옵션 X (점진) = 회귀 위험 차이
   - 라이브 운영 중 시스템은 점진이 정석

3. **"메일 = 올드" 의 직관**
   - LEE 의 비기술적 직관이 SaaS 표준과 일치
   - 사용자/운영자 직관 + 기술 검토 결합 = 좋은 설계

---

## Appendix A: ADR 시리즈 진화 (8번째)

| ADR | 영역 | 옵션 수 | 채택 | 트리거 |
|-----|------|--------|-----|--------|
| 0001 | 비즈니스 | 3 | A | 초기 설계 |
| 0002 v2 | 기술 | 2 | A | 피드백 |
| 0003 | 기술 | 3 | A | 어드민 도입 |
| 0004 | 비즈니스+법무 | 4 | C | 결제 준비 |
| 0005 | 기술 버그 | 3 | A | Phase 2-C 버그 |
| 0006 | 기술 버그 | 3 | A | 알림 동기화 버그 |
| 0007 | 메타 (회고) | N/A | N/A | Phase 2 마무리 |
| **0008** | **기술 + 비즈니스** | **3** | **X** | **ADR-0006 트리거 + LEE 요구** |

8번째. **ADR 이 ADR 을 트리거** 하는 사례 첫 발생 (0006 → 0008).

---

## Appendix B: 구현 시 주의사항

### 6시간 한계 관리
```
17:30 시작 (가정)
19:30 (2시간) — Step 1 중간 보고: 마이그레이션 + 어드민 페이지 진행
21:30 (4시간) — Step 2 시작: 컨슈머 + 알림 통합
23:30 (6시간) — STOP 한계
```

### 회귀 테스트 필수
- 기존 분석 알림 동작 (헤더 벨 배지)
- "모두 읽음" 동작
- 다른 브라우저 동기화 (4/24 패턴)

### 데이터 마이그레이션 X
- 기존 메일 문의 = inquiries 테이블에 백필 안 함
- 기존 analysis_jobs.read_at = 그대로 유지

### 일회성 예외 권한 범위
- `/api/contact/inquiry/route.ts`
- 새 `/account/inquiries/page.tsx`
- 헤더 벨 알림 컴포넌트 (정확한 경로는 Claude Code 가 식별)

---

**End of ADR-0008 v1.**
