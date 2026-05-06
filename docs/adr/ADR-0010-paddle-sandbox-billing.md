# ADR-0010: Phase 3a — Paddle Sandbox 결제 시스템 구축 (Billing + Webhook + NAT 매핑)

**Status**: Proposed  
**Date**: 2026-04-28  
**Author**: LEE  
**Reviewer**: 웹 Claude (사전 조사 + 본문 검토)  
**Context**: Novel Agent / Phase 3a (Paddle Sandbox 연동)  
**Related**: ADR-0001 (NAT 토큰 모델), ADR-0004 (결제 오픈 Go/No-Go), ADR-0008 (notifications 활용), ADR-0009 (Phase 3 로드맵)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-28 | 초안 — Paddle Billing(Sandbox) 결제 모델 + Webhook 설계 + NAT 매핑 정책 + Hybrid 처리 아키텍처 |
| v2 | 2026-05-06 | §5 운영 룰 추가 — 새 Paddle price 추가 시 마이그레이션 선행 의무 (FK 제약으로 인한 결제 사고 방지) + production 전환 매핑 주의 |

---

## 1. Context (배경)

Novel Agent 는 ADR-0001 에서 **NAT(크레딧) 기반 과금** 모델을 확정했다.  
Phase 3a 의 목적은 **실결제(Production) 없이도** 결제 파이프라인(Checkout → Webhook → NAT 반영 → 어드민 추적)을 **Sandbox에서 끝까지 검증**하는 것이다.

제약/전제:
- 1인 운영, CS 비용이 치명적이므로 **멱등성·추적성·알림**이 핵심
- Phase 3a/3b 는 **Sandbox만 운영** (실제 돈 0원)
- Production 전환은 ADR-0004 Go/No-Go 이후 (Phase 3c)

---

## 2. Decision (결정)

### 2-1. 환경: Paddle Billing (Classic 미사용)

- Paddle 제품은 **Billing**(신규)을 사용한다. (Classic 제외)
- Sandbox 가입 및 Webhook destination 생성은 완료 상태로 가정한다.

### 2-2. 결제 모델 (한국 시장 최적화)

- **Currency**: KRW 단일
- **Tax mode**: Inclusive
- **결제수단 활성화(한국 Tier 1+2)**:
  - South Korea Local Cards
  - KakaoPay / NaverPay / Samsung Pay / Payco
- **비활성**:
  - Apple Pay / Google Pay / PayPal / 기타 지역 전용 수단

근거:
- “한국 결제망만”을 구조적으로 강제해 **DCC(동적 통화 변환) 노출/리스크**를 원천 차단한다.
- 글로벌 결제수단은 Phase 3c 이후(사업자 등록/운영 안정화 후) 재검토한다.

### 2-3. Sandbox 자산(식별자)

- Product: `standard_test` (SaaS)
- Price: `pri_01kq4a0q6a25n4fsd8frdjva2e`  
  - 9,900원/월, Monthly, Inclusive, Active
- Client-side Token: `sandbox-frontend-v1`
- Webhook destination: 생성 완료

> 주의: 위 price_id 등 식별자는 **DB 매핑 테이블의 초기 seed**로만 사용한다. 코드에 하드코딩은 최소화한다.

---

## 3. Webhook 설계

### 3-1. Destination 전략

- **단일 destination + price_id 매핑 테이블**을 Single Source of Truth로 둔다.
- Sandbox / Production 은 **별도 destination + 별도 secret**으로 완전 격리한다.
- URL 분기:
  - `POST /api/paddle/webhook/sandbox`
  - `POST /api/paddle/webhook/production` (Phase 3c에서 활성)

### 3-2. 수신 이벤트 (Tier 1~4)

Tier 1 (결제 핵심)
- `transaction.completed`
- `transaction.payment_failed`
- `subscription.activated`
- `subscription.canceled`
- `subscription.past_due`
- `subscription.updated`

Tier 2 (환불/정산)
- `adjustment.created`

Tier 3 (고객)
- `customer.created`

Tier 4 (보안)
- `api_key.expiring`
- `api_key.expired`
- `api_key.revoked`
- `api_key_exposure.created`
- `client_token.revoked`

> 운영 시점에 실제로 전송되는 이벤트 종류는 Paddle 설정에 따라 달라질 수 있다. 그러나 “필수 처리” 기준은 위 Tier를 따른다.

---

## 4. Webhook 처리 아키텍처: Hybrid (BM별 분기)

목표:
- 결제/구독 핵심 상태는 **수 초 내 반영**
- 동시에 webhook 5초 내 응답 요구에 맞추어 **장기 작업을 분리**
- 실패 시에도 “언젠가 처리됨”을 보장

결정:
- **동기 즉시 처리**
  - NAT 추가 구매(원타임) 반영
  - 첫 구독/활성화 반영
  - `customer.created`
  - 보안 이벤트(키 노출/폐기)
- **큐 + Cron 처리**
  - 구독 갱신, 취소, past_due, 알림성 이벤트 등
- **동기 실패 시**
  - 큐 fallback 기록 후 1분 주기 재처리(Cron)
- **30초 이상 미반영**
  - 어드민 자동 알림(ADR-0008 `notifications` 활용)

---

## 5. NAT 매핑 정책 (price_id → NAT)

### 5-1. Single Source of Truth

- `paddle_price_nat_mapping` 테이블이 진실 원천이다.
- Paddle Custom Data 는 **보조용**으로만 사용한다.

### 5-2. 알 수 없는 price_id 처리

- 미매핑 price_id 발견 시:
  - **NAT 충전 차단**
  - `paddle_transactions.status = 'unmapped'`
  - 어드민 알림 발송 (즉시)

### 5-3. 새 Paddle Price 추가 운영 룰

**배경**

- `paddle_subscriptions.paddle_price_id` 는 `paddle_price_nat_mapping(paddle_price_id)` 를 **FK로 참조**한다.
- 매핑 테이블에 없는 price_id 로 webhook 이 들어오면 `subscription.activated` 핸들러의 UPSERT 가 **FK violation 으로 실패**한다.
- 결과: 사용자는 결제 성공했지만 시스템에 구독 row 없음, NAT 도 미지급. CS 폭발 + 환불 처리 부담.

**필수 작업 순서 (반드시 이 순서로)**

1. `paddle_price_nat_mapping` 에 신규 매핑을 INSERT 하는 마이그레이션 작성 + 적용
2. 적용 확인 쿼리로 mapping 존재 검증
3. **그 다음에** Paddle 어드민에서 신규 price 생성 (sandbox 또는 production)
4. Paddle 어드민에서 신규 price 활성화 / checkout 노출

순서가 뒤집히면 그 시점부터 결제 성공해도 구독 저장이 실패한다. **Paddle plan 생성을 먼저 하지 말 것.**

**신규 price 추가 체크리스트**

- [ ] 매핑 마이그레이션 작성 (`paddle_price_id`, `nat_amount`, `description`, `environment`)
- [ ] 마이그레이션 적용 (Supabase Dashboard SQL Editor)
- [ ] `SELECT * FROM paddle_price_nat_mapping WHERE paddle_price_id = '<새_price_id>'` 로 검증
- [ ] Paddle 어드민에서 price 생성
- [ ] Paddle 어드민에서 price 활성화
- [ ] Sandbox 에서 결제 테스트 1건
- [ ] `paddle_subscriptions` 에 row 정상 저장 확인
- [ ] (해당 시) NAT 지급 정상 작동 확인

### 5-4. Production 전환 시 매핑 주의

현재 `paddle_price_nat_mapping` 은 **sandbox seed 만 존재**한다 (마이그레이션 `20260428160000_paddle_billing_phase3a.sql` 의 `pri_01kq4a0q6a25n4fsd8frdjva2e` 1건).

Production 전환 시:

- production 환경의 price_id 는 sandbox 와 **다른 식별자**이다.
- `environment = 'production'` 으로 별도 매핑 row 가 필요하다.
- production seed 마이그레이션을 **production webhook 활성화 전에** 적용해야 한다.
- 이 작업은 ADR-0004 Go/No-Go 통과 후 production 전환 단계 (§8 Phase 3c) 의 사전 작업으로 진행한다.

---

## 6. Free Trial / BM

- Paddle Free trial = **0**
- 대신 **주 3 NAT 자동 충전**(ADR-0001)이 trial 역할을 한다.
- BM 재설계는 Phase 3a 완료 후 **ADR-0001 v2**에서 검토한다.

---

## 7. 환불 정책

- 일반 환불: 불가 (디지털 재화 관행)
- 오류 보상: 어드민 NAT 수동 충전(이미 구현)
- `adjustment.created`는 “환불/차지백” 신호로 수신해 **알림** 중심으로 처리한다.

---

## 8. Compliance 타임라인 (Phase 3c 트리거)

- 현재: LEE 개인(sole proprietor)로 Paddle 검수 통과
- Phase 3a/3b: Sandbox만 운영, 실제 결제 0건(합법)
- Phase 3c 트리거: 실업급여 종료 + 사업자 등록 + 세무사 선임
- Production 활성화는 ADR-0004 Go/No-Go 통과 후

---

## 9. Data Model / Migration (신규 테이블)

Phase 3a 에서 아래 테이블을 추가한다.

1) `paddle_webhooks`: 멱등성 + 추적 (processed_at NULL = 미처리 큐)  
2) `paddle_price_nat_mapping`: price_id → NAT 매핑 (SSOT)  
3) `paddle_transactions`: 결제/구독 트랜잭션 로그  
4) `users.paddle_customer_id`: Paddle customer id 저장

> `users.id`가 bigint이므로, `paddle_transactions.user_id`도 bigint(`public.users(id)`)로 유지한다.

---

## 10. Env Vars (Phase 3a Sandbox)

```bash
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<sandbox-frontend-v1 토큰값>
NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY=pri_01kq4a0q6a25n4fsd8frdjva2e

PADDLE_API_KEY_SANDBOX=<sandbox API key>
PADDLE_WEBHOOK_SECRET_SANDBOX=<webhook destination secret>
```

---

## 11. Code Structure (제안)

```
src/
├── lib/paddle/
│   ├── client.ts              # initializePaddle (use client)
│   ├── config.ts              # 환경변수 + price_id 상수
│   ├── webhook-verify.ts      # HMAC-SHA256 서명 검증
│   ├── nat-credit.ts          # NAT 충전 (credit_nat RPC 호출)
│   └── types.ts
├── app/api/paddle/webhook/
│   ├── sandbox/route.ts       # Sandbox 핸들러
│   └── production/route.ts    # Production 핸들러 (Phase 3c)
└── components/pricing/
    ├── checkout-button.tsx
    ├── pricing-page.tsx
    └── nat-charge-section.tsx
```

---

## 12. Risks (요약) + Mitigation

1. **DCC 차단 실패**  
   - Tier 1+2만 활성화로 구조적 제거 (리스크 낮음)
2. **Paddle API 키 노출**  
   - 환경변수 분리 + 키 회전(6개월) + 보안 webhook 수신
3. **Webhook 5초 룰 위반**  
   - Hybrid 처리로 장기 작업 분리
4. **미매핑 price_id**  
   - NAT 충전 차단 + 어드민 알림
5. **환경 혼동(sandbox/prod)**  
   - URL 분기 + 기본값 sandbox
6. **컴플라이언스(사업자 등록 전 활성화)**  
   - ADR-0004 Go/No-Go 없이는 production 금지
7. **NAT 충전 지연(CS 발생)**  
   - 핵심 이벤트는 동기 처리(수 초 내) + 실패 시 큐 fallback

---

## 13. Work Plan (Phase 3a)

- Step 1: 마이그레이션 작성 + 적용 (1~2시간)
- Step 2: `@paddle/paddle-js` 설치 + 환경변수 (30분)
- Step 3: Webhook 핸들러 — 서명 검증 + 멱등성 + Hybrid 처리 (1~2일)
- Step 4: 결제 흐름 코드 — 컨슈머(`/pricing`, `/studio/charge`) (1~2일)
- Step 5: NAT 충전 자동화 (`credit_nat` RPC 활용) (1일)
- Step 6: 어드민 결제 내역 UI (1~2일, 별도 작업 단위)
- Step 7: 통합 테스트 + 빌드 검증 (1일)

총: 베타 운영 병행 시 1~2주

---

## 14. Phase 3a Exit Criteria

- Sandbox 테스트 결제 → NAT 자동 충전 동작
- 어드민 결제 내역에서 거래 노출
- 환경변수 토글로 sandbox/production 분기 검증
- ADR-0011(Phase 3b Staging) 작성 시작 가능

---

**End of ADR-0010 v1.**

