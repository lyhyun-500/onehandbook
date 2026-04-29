# ADR-0011: NAT 회계 분류 + 유효기간 정책

**상태**: Proposed
**작성일**: 2026-04-29
**작성자**: LEE
**검토자**: LEE (자기 검토)
**관련 ADR**: ADR-0001 (NAT 토큰 모델), ADR-0010 (Phase 3a Paddle 결제)

---

## 1. Context (배경)

### 1-1. 발견 시점

ADR-0010 의 Phase 3a Step 3-4 (NAT 충전 핸들러 구현) 작성 직전, LEE 가 이전 PM 경력 (탑코미디어 / 탑툰 웹툰 플랫폼) 의 회계 처리 패턴을 짚음:
- **충전 코인** = 정산 대상 (작가 RS 분배 + 매출 부채)
- **보너스 코인** = 정산 대상 X (마케팅 비용)
- 이 분리가 회계 / 세무 처리상 필수

→ Novel Agent 도 동일 원칙 적용 필요.

### 1-2. 무기한 NAT 의 회계 부담

LEE 가 두 번째로 짚은 이슈: 유효기간 없는 NAT = 영구 부채.

**시나리오:**
2026: 사용자 A 결제 100 NAT (부채 9,900원)
2030: 미사용 (부채 그대로)
2035: 누적 부채 → 재무제표 부담

→ 유효기간 설정 + 만료 시 자동 소멸 + 매출 인식 패턴 필수.

### 1-3. 현재 NAT 시스템 (ADR-0001 기준)

기존 데이터 모델:
- `users.coin_balance` (단일 잔량, integer)
- `coin_logs` (변동 이력, 분류 X)
- `credit_nat` RPC (단일 함수, reason enum 5종)

→ **회계 분류 / 유효기간 추적 불가능한 구조**.

### 1-4. 법적 함의

- 한국 전자상거래법 / 소비자보호법: 선불 디지털 화폐 약관에 유효기간 명시 의무
- 무기한 NAT + 약관 미명시 = 소비자 분쟁 리스크
- 만료 임박 사전 고지 의무 (3개월 전)

---

## 2. Decision (결정)

### 2-1. NAT 회계 분류 (Grant Type)

NAT 발행 시점에 두 가지 분류로 구분:

**`paid` — 결제 NAT (정산 대상, 부채)**
- 출처:
  - Paddle 결제 (`transaction.completed`, `subscription.activated`)
  - 추후 다른 결제 채널 (TossPayments 등)
- 회계: 부채 (deferred revenue)
- 세무: 매출 인식은 사용 시점 또는 만료 시
- 환불 가능

**`bonus` — 보너스 NAT (마케팅 비용, 부채 X)**
- 출처:
  - 휴대폰 인증 보너스
  - 베타 자동 충전 (주 3 NAT)
  - 신규 가입 보너스
  - 프로모션 / 이벤트
- 회계: 마케팅 비용 (즉시 인식)
- 세무: 비용 처리
- 환불 불가

**기존 reason enum 매핑:**
'purchase_credit' → grant_type: 'paid'
'refund'          → grant_type: 'paid' (환불 NAT 도 결제 분류 유지)
'bonus'           → grant_type: 'bonus'
'admin_adjust'    → grant_type: 'bonus' (어드민 조정은 비용 처리)
'manual_adjust'   → grant_type: 'bonus'
'other'           → grant_type: 'bonus' (default)

### 2-2. 유효기간 정책

**기본 원칙: 발행일로부터 5년**

근거:
- 탑툰 등 한국 디지털 콘텐츠 플랫폼 표준 (3~5년)
- 5년 = 사용자 신뢰 + 회계 부담 균형
- 한국 상사시효 5년과 일치

**만료 처리:**
- 발행일 + 5년 시점에 미사용 NAT → 자동 소멸
- 회계 처리: 부채 9,900원 (예) → 매출 인식 (소멸 매출)
- 사용자 화면: 잔량에서 차감 + 알림 발송

**사전 고지 의무:**
- `/terms` 또는 `/refund` 페이지에 유효기간 5년 명시
- NAT 충전 UI 에 "유효기간 5년" 표시
- 만료 임박 알림 자동 발송 (1년 / 6개월 / 1개월 / 1주일 전)

**FIFO 사용 원칙:**
- NAT 사용 시 **만료 임박 NAT 부터 차감** (First-In-First-Out)
- 사용자 입장: 자연스러움 (오래된 거 먼저)
- 회계 입장: 부채 정리 효율 ↑

### 2-3. 데이터 모델 적용 단계

**Phase 3a (이번 ADR 적용 시점)**:
- `credit_nat` RPC 보강 (`p_expires_at`, `p_grant_type` 인자 추가)
- `coin_logs.metadata` 에 분류 + 만료일 저장
- `users.coin_balance` 통합 잔량 유지 (분리 X)

**Phase 3a 이후 (별도 ADR)**:
- `coin_grants` 테이블 신설 (NAT 발행 단위 추적)
- `users` 컬럼 분리 (`paid_coin_balance` / `bonus_coin_balance`) — 선택사항
- 만료 처리 Cron 워커 구현
- FIFO 차감 로직 (`consume_nat` RPC 보강)

→ **Phase 3a 단계는 metadata 활용 임시 처리**. 풀 데이터 모델은 추후.

---

## 3. Architecture (아키텍처)

### 3-1. credit_nat RPC v2 시그니처

기존 함수에 인자 2개 추가:

```sql
CREATE OR REPLACE FUNCTION public.credit_nat(
  p_user_id bigint,
  p_amount integer,
  p_reason text,
  p_ref_type text DEFAULT NULL,
  p_ref_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,    -- ★ 신규
  p_grant_type text DEFAULT NULL            -- ★ 신규
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_new int;
  v_reason text;
  v_grant_type text;
  v_expires_at timestamptz;
  v_meta jsonb;
BEGIN
  -- 기존 amount / reason 검증 그대로
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;
  
  IF p_reason IS NULL OR p_reason NOT IN (
    'purchase_credit', 'refund', 'bonus', 'admin_adjust', 'manual_adjust', 'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  -- ★ grant_type 자동 결정 (명시 X 시 reason 으로부터 추론)
  IF p_grant_type IS NULL THEN
    v_grant_type := CASE p_reason
      WHEN 'purchase_credit' THEN 'paid'
      WHEN 'refund' THEN 'paid'
      ELSE 'bonus'
    END;
  ELSIF p_grant_type IN ('paid', 'bonus') THEN
    v_grant_type := p_grant_type;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_grant_type');
  END IF;

  -- ★ expires_at 자동 설정 (명시 X 시 5년 후)
  v_expires_at := COALESCE(p_expires_at, now() + INTERVAL '5 years');

  v_reason := CASE p_reason
    WHEN 'purchase_credit' THEN 'PURCHASE_CREDIT'
    WHEN 'refund' THEN 'REFUND'
    WHEN 'bonus' THEN 'BONUS'
    WHEN 'admin_adjust' THEN 'ADMIN_CREDIT'
    WHEN 'manual_adjust' THEN 'MANUAL_ADJUST'
    ELSE 'OTHER'
  END;

  -- 잔량 업데이트 (기존)
  UPDATE public.users
  SET coin_balance = coin_balance + p_amount
  WHERE id = p_user_id AND deleted_at IS NULL
  RETURNING coin_balance INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- ★ metadata 에 grant_type + expires_at 박기
  v_meta := COALESCE(p_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'grant_type', v_grant_type,
              'expires_at', v_expires_at
            );

  -- 로그 INSERT (기존 + metadata 보강)
  INSERT INTO public.coin_logs (
    user_id, amount, type, reason, ref_type, ref_id, metadata
  ) VALUES (
    p_user_id,
    p_amount,
    'EARN',
    v_reason,
    p_ref_type,
    p_ref_id,
    v_meta
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_new,
    'grant_type', v_grant_type,
    'expires_at', v_expires_at
  );
END;
$$;
```

**특징:**
- 기존 호출 코드 그대로 작동 (인자 추가만 = 하위 호환)
- grant_type 명시 X 시 reason 으로 자동 추론
- expires_at 명시 X 시 5년 후 자동 설정
- coin_logs.metadata 에 추적 정보 영속화

### 3-2. 호출 코드 패턴

**Paddle 결제 (handle-transaction-completed.ts):**
```typescript
await supabase.rpc('credit_nat', {
  p_user_id: user.id,
  p_amount: mapping.nat_amount,
  p_reason: 'purchase_credit',
  p_ref_type: 'paddle_transaction',
  p_ref_id: txnId,
  p_metadata: { ... },
  // ★ 명시 X → 자동 추론 (paid + 5년 후)
});
```

**휴대폰 인증 보너스 (별도 채팅):**
```typescript
await supabase.rpc('credit_nat', {
  p_user_id: userId,
  p_amount: 30,
  p_reason: 'bonus',
  p_ref_type: 'phone_verification',
  // ★ 명시 X → 자동 추론 (bonus + 5년 후)
});
```

**프로모션 NAT (특수 유효기간):**
```typescript
await supabase.rpc('credit_nat', {
  p_user_id: userId,
  p_amount: 50,
  p_reason: 'bonus',
  p_grant_type: 'bonus',
  p_expires_at: '2026-12-31T23:59:59Z',  // ★ 짧은 유효기간 명시
  p_ref_type: 'event_winter_2026',
});
```

### 3-3. coin_logs.metadata 조회 패턴

미래 운영 시 만료 임박 NAT 식별:

```sql
-- 30일 내 만료 예정 NAT 보유 유저 식별
SELECT 
  user_id,
  amount,
  metadata->>'grant_type' AS grant_type,
  (metadata->>'expires_at')::timestamptz AS expires_at,
  ref_type,
  ref_id
FROM public.coin_logs
WHERE type = 'EARN'
  AND (metadata->>'expires_at')::timestamptz BETWEEN now() AND now() + INTERVAL '30 days'
ORDER BY (metadata->>'expires_at')::timestamptz;
```

→ Phase 3a 후 만료 처리 Cron 워커가 활용.

---

## 4. Tradeoffs (트레이드오프)

### 4-1. 데이터 모델 — 통합 잔량 vs 분리 잔량

**채택: 통합 잔량 (`users.coin_balance`) + metadata 분류**

| 옵션 | 장점 | 단점 |
|---|---|---|
| 통합 잔량 (채택) | 마이그레이션 불필요, 빠른 진행 | 분류별 잔량 조회는 coin_logs 집계 필요 |
| 분리 잔량 (`paid_coin_balance` / `bonus_coin_balance`) | 분류별 잔량 즉시 조회 | 마이그레이션 필요, FIFO 차감 로직 복잡 |

**근거**: Phase 3a 단계 = 빠른 진행. 통합 잔량 + metadata 로 충분. 풀 분리는 Phase 3a 후 별도 ADR.

### 4-2. 유효기간 — 5년 vs 다른 기간

**채택: 5년**

| 옵션 | 장점 | 단점 |
|---|---|---|
| 1년 | 부채 회수 빠름 | 사용자 불만 ↑ (가장 짧음) |
| 3년 | 부채 회수 적당 | 일부 디지털 콘텐츠 표준보다 짧음 |
| 5년 (채택) | 사용자 신뢰 + 회계 균형 | 부채 회수 느림 |
| 7년 | 사용자 만족 ↑ | 부채 부담 ↑ |
| 무기한 | 사용자 만족 최대 | 영구 부채 |

**근거**: 한국 상사시효 5년 + 탑툰 등 표준 사례.

### 4-3. 자동 추론 vs 명시 강제

**채택: 자동 추론 (명시 시 우선)**

```sql
IF p_grant_type IS NULL THEN
  v_grant_type := CASE p_reason ... END;
END IF;
```

| 옵션 | 장점 | 단점 |
|---|---|---|
| 자동 추론 (채택) | 기존 호출 코드 호환, 빠른 적용 | 추론 규칙 명확해야 함 |
| 명시 강제 (NULL 거부) | 명확성 ↑ | 기존 코드 모두 수정 필요 |

**근거**: Phase 3a 진행 우선. 자동 추론 규칙을 ADR 에 명시해서 미래 헷갈림 방지.

---

## 5. Risks (리스크 + 대응)

### 5-1. 자동 추론 규칙의 함정

**위험**: `'admin_adjust'` 가 자동으로 `'bonus'` 분류됨. 다만 어드민이 결제 환불 처리할 때 `'admin_adjust'` 사용하면 회계상 부채 회수가 비용 처리로 잘못 분류될 가능성.

**대응**: 어드민 환불은 `'refund'` 사용 의무화. ADR-0010 의 "오류 보상은 어드민 NAT 수동 충전" 패턴 = `'admin_adjust'` 가 맞음 (마케팅 비용 처리). 정상.

### 5-2. 유효기간 5년 의 회계 부담

**위험**: 5년간 사용자 잔량 누적 → 큰 부채 부담.

**대응**:
- Phase 3a 후 만료 처리 Cron 워커로 자동 소멸
- 분기별 재무 보고서에 만료 매출 별도 표시
- 사용자별 잔량 모니터링 어드민 UI (별도 ADR)

### 5-3. 약관 / UI 사전 고지 의무 미이행

**위험**: 5년 유효기간을 코드에는 박았는데 사용자가 인지 못 함 → 분쟁 리스크.

**대응**:
- `/terms` / `/refund` 페이지에 명시 (사용자 확장 채팅에서 처리)
- NAT 충전 UI 에 "유효기간 5년" 표시 의무
- ADR-0010 의 결제 흐름 코드에 사전 고지 모달 추가 (Step 4 영역)

### 5-4. 분류 마이그레이션 시점 데이터 손실

**위험**: Phase 3a 후 풀 데이터 모델 (분리 잔량 + coin_grants 테이블) 마이그레이션 시 기존 NAT 분류 모호.

**대응**:
- Phase 3a 단계의 모든 credit_nat 호출이 metadata 에 grant_type + expires_at 저장
- 마이그레이션 시 metadata 기반으로 정확히 분류
- 기존 데이터 (이미 발행된 NAT) 도 reason 으로 추론

---

## 6. 작업 단계 (Implementation Plan)

### 6-1. 이번 ADR 적용 시점 (Phase 3a 진행 중)
[1] 마이그레이션 작성 + 적용 (15분)

credit_nat RPC v2 (인자 2개 추가)
하위 호환 보장

[2] handle-transaction-completed.ts 수정 (15분)

p_metadata 에 추가 정보
명시 인자 X (자동 추론 활용)

[3] 빌드 검증 (5분)
[4] 향후 핸들러 (Step 3-4-B/C/D) 도 v2 RPC 사용

### 6-2. Phase 3a 후 (별도 ADR)
[ADR-0012 (가칭) — NAT 만료 자동 처리]

만료 임박 알림 (1년/6개월/1개월/1주일 전)
만료 NAT 자동 소멸 Cron 워커 (월 1회)
사용자 화면 만료 임박 표시

[ADR-0013 (가칭) — NAT 데이터 모델 v2]

coin_grants 테이블 신설
users 컬럼 분리 (선택)
FIFO 차감 로직 (consume_nat RPC v2)
마이그레이션: 기존 coin_logs.metadata → coin_grants


### 6-3. 약관 / UI (별도 채팅)

/terms 또는 /refund 페이지에 "NAT 유효기간 5년" 명시
NAT 충전 UI 에 유효기간 표시
만료 임박 알림 시스템 (notifications 활용)
베타 단계 = 사전 고지로 충분


---

## 7. 후속 ADR 계획

| ADR 번호 | 제목 | 시점 |
|---|---|---|
| ADR-0012 (가칭) | NAT 만료 자동 처리 + Cron | Phase 3a 종료 후 |
| ADR-0013 (가칭) | NAT 데이터 모델 v2 (coin_grants 테이블) | Phase 3a 종료 후 |
| ADR-0014 (가칭) | NAT 회계 / 세무 처리 가이드 | 사업자 등록 + 세무사 후 |

---

## 8. 도메인 사례 (LEE PM 경험)

### 8-1. 탑툰 (탑코미디어, LEE 5년 경력)

**충전 코인 vs 보너스 코인 분리:**
- 충전 코인 = 작가 RS 분배 + 매출 부채
- 보너스 코인 = 마케팅 비용 (이벤트 / 신규 가입 / 휴대폰 인증)
- 회계감사 시 분리로 회계 처리 명확화 + 작가 정산 정확성

**Novel Agent 적용:**
- 작가 RS 분배는 없지만 동일 원칙 (부채 vs 비용 분리)
- 향후 B2B / 작가 수익 분배 도입 시 즉시 확장 가능

### 8-2. 무기한 코인의 회계 함정

**탑툰 초기 사례 (LEE 가 인지한 패턴):**
- 코인 유효기간 명시 X → 누적 부채 → 재무제표 부담
- 추후 유효기간 도입 시 사용자 분쟁 (소급 적용 불가)
- → "처음부터 박아두는 게 정답"

**Novel Agent 적용:**
- 베타 단계부터 5년 유효기간 명시
- 사용자 사전 고지로 분쟁 회피
- 회계 부담 사전 차단

---

## 9. 결정 로그

| 결정 항목 | 결정 | 결정자 | 날짜 |
|---|---|---|---|
| NAT 분류 (paid/bonus) | 2 종류 | LEE | 2026-04-29 |
| 유효기간 | 5년 | LEE | 2026-04-29 |
| credit_nat 보강 방식 | 기존 함수 인자 추가 (하위 호환) | LEE | 2026-04-29 |
| Grant type 자동 추론 | reason 으로부터 자동 (명시 시 우선) | LEE | 2026-04-29 |
| FIFO 사용 원칙 | 만료 임박 우선 차감 | LEE | 2026-04-29 |
| 풀 데이터 모델 마이그레이션 시점 | Phase 3a 후 (별도 ADR) | LEE | 2026-04-29 |

---

**End of ADR-0011**
