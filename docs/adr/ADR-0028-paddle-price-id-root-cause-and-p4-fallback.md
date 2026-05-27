# ADR-0028: TS-003 Root Cause 재정의 + Price ID 추출 갭 처방 + P4 Custom Data Fallback

## 상태
Accepted (2026-05-27)

## 컨텍스트

### 본 ADR 의 배경 사실
- TS-003 (2026-05-07) 처방 commit: `cdf5c99` ("queue trap → 전부 sync 처리")
- 19일 공백 후 2026-05-26 핸드오프 (LEE 작성)
- 본 세션 (2026-05-27) e2e 재검증 시도 → silent fail 재현
- 진단 절차 갱신 후 진짜 root cause 식별 + 처방 + 검증 완료

### Silent fail 시간선 사실
- 2026-05-07 결제 3건: paddle_webhooks transaction.completed 3건 도착, `processed_at IS NULL` 영구 정체
- 2026-05-27 결제 2건 (P4 처방 시도 전): 동일 silent fail 재현
- 본 세션 코드 read + Vercel runtime log 사실 확보:
```
01:07:46.552  [handleTransactionCompleted] price_id 없음: txn_01kskfhh2cny2w5jrvm64mecm9
01:07:46.554  [paddle event-handler] 동기 처리 실패: Error: no_price_id
```

### SQL 검증 사실
실제 Paddle payload 의 items 구조 직접 검증 (정체 webhook payload jsonb_path_query):
```
items_price_nested:   ["pri_01kq4a0q6a25n4fsd8frdjva2e"]
items_price_singular: []
```

→ nested path (`items[].price.id`) = 정합 / 단축 path (`items[].price_id`) = 빈배열 = 사실 부재.

## 결정

### 1. TS-003 Root Cause 재정의
TS-003 의 처방 (sync 강제) = handler 호출 자체는 보장. 그러나 진짜 root cause = handler 내부 코드 갭:

- `handle-transaction-completed.ts:37` 의 추출 코드: `const priceId = txn.items[0]?.price_id;` (단축 path)
- Paddle 실제 payload 구조: `data.items[0].price.id` (nested object)
- TS 정의 사실 (`event-types.ts`):
  - `PaddleSubscription.items[].price.id` (nested, 정합)
  - `PaddleTransaction.items[].price_id` (단축, 갭)
- → handler 가 시도한 추출 = undefined → `no_price_id` return → event-handler 가 throw 변환 → queue fallback → Cron 미구현 → 영구 정체

### 2. Price ID 추출 갭 처방 (commit: 82f67ae)
변경 2 파일, +6/-2:
- `handle-transaction-completed.ts:37`: nested path 우선 + 단축 path fallback
- `event-types.ts` `PaddleTransaction.items` 타입 확장 (`price?: { id: string }` 추가, `price_id` optional)

```ts
// Before
const priceId = txn.items[0]?.price_id;

// After
const firstItem = txn.items?.[0];
const priceId =
  (firstItem as { price?: { id?: string } } | undefined)?.price?.id ??
  (firstItem as { price_id?: string } | undefined)?.price_id;
```

### 3. P4 Custom Data Fallback 처방 (commits: f6c68b8 + 0761860)
부수 처방 — `paddle_customer_id` 미매핑 케이스 (customer.created handler 미구현 사실 정합):

- `StandardPlanButton` 의 openCheckout 호출 시 `customData.user_id` 전달
- `handle-transaction-completed.ts` 의 user 조회 path 에 fallback 추가
- fallback 성공 시 `users.paddle_customer_id` 영구 UPDATE
- `handle-subscription-activated.ts` 에 동일 패턴 적용

## 결과 (검증 사실)

### Production 검증 (2026-05-27 02:07 KST)

| 메트릭 | 사실 |
|---|---|
| paddle_transactions 첫 정상 row | `txn_01kskjyr6ze651nbnsv7178ze2` |
| status / nat_credited | completed / 100 |
| user1 coin_balance | 950 → 1050 |
| user1 paddle_customer_id | NULL → `ctm_01kskcxq5rjqeyfvxwtrryxaxm` (P4 fallback UPDATE 정합) |
| webhook processed_at latency | 1.97s (sync 처리 정합) |
| coin_logs PURCHASE_CREDIT | 신규 row + grant_type=paid + expires_at 5년 |

### 본 세션 commit history (5건)
- `819a08b` — feat: LEE-only E2E test entry point (page.tsx +19)
- `f6c68b8` — fix(paddle): P4 custom_data fallback (transaction, 3 파일 +42/-3)
- `82f67ae` — fix(paddle): price_id nested path (root cause, 2 파일 +6/-2)
- `0761860` — fix(paddle): P4 fallback (subscription, 1 파일 +31/-1)
- `c6c3deb` — feat(pricing): TopBar + 홈 Link (1 파일 +13/-1)
- → main 머지: `c24cc35` (PR #11)

### 정리 작업 결과 (2026-05-27 03:14 KST)
- paddle_webhooks: 22 marked + 7 processed + 0 pending = 29
- paddle_subscriptions: 6 canceled + 0 active
- paddle_transactions: 1 (NAT credit 검증 결과 보존)
- user 1: coin_balance 1050 / paddle_customer_id `ctm_01kskcxq...`

## 잔존 의제
- handle-subscription-activated 의 P4 적용 후 subscription.user_id 매핑 사실 검증 (재결제 또는 갱신 시)
- customer.created handler 미구현 (이전 핸드오프 §3-B TODO 정합)
- Queue 5종 처리 옵션 결정 (Cron / sync 전환 / 알림만)
- error 컬럼 사용 (handler throw 시 기록)
- waitUntil swallow 개선 (백그라운드 실패 어드민 알림)
- PADDLE_E2E_TEST_TEMPORARY 마커 2건 제거 (production 진입 시점)
- ADR-0010 (Paddle Sandbox Billing) v3 → v4 갱신 의제 (본 ADR 사실 반영)

## 참조
- `docs/redesign/handoff-2026-05-26-paddle-billing-resume.md` (본 세션 진입 컨텍스트)
- ADR-0010 (Paddle Sandbox Billing v3)
- TS-002 (NEXT_PUBLIC env dynamic access)
- TS-003 (subscription transaction queue trap) — 본 ADR 로 root cause 재정의됨
