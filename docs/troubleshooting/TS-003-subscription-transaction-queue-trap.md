# TS-003: 구독 transaction.completed 가 queue 로 빠져 NAT 미충전

## 1. Summary

| 항목 | 내용 |
|---|---|
| 발생 일시 | 2026-05-07 (sandbox 검증 단계) |
| 발견 경로 | sandbox 결제 1건 후 `paddle_transactions` row 미생성, NAT 미충전 직접 확인 |
| 심각도 | High (가상 production 시) — sandbox 발현이라 실유저 영향 0 |
| 영향 범위 | production 시 모든 첫 구독 결제가 NAT 미충전 + Cron 워커 미구현으로 영구 미처리 |
| 해결 방법 | ADR-0010 §4-1 — 모든 `transaction.completed` sync 처리로 변경 (옵션 1 채택) |
| 관련 ADR | [ADR-0010](../adr/ADR-0010-paddle-sandbox-billing.md) §4-1 |
| 관련 인시던트 | [TS-002](TS-002-nextpublic-env-dynamic-access.md) — 같은 paddle wire-up 작업 중 발견된 직전 사건 |

---

## 2. Timeline

| 시점 | 이벤트 |
|---|---|
| 2026-04-28 | 마이그레이션 `20260428160000_paddle_billing_phase3a.sql` — `paddle_price_nat_mapping` seed 작성, `standard_monthly` 를 `product_type='subscription'` 으로 등록 |
| 2026-05-06 | paddle wire-up 배포 (commit `c514695`) — sandbox 결제 검증 준비 완료 |
| 2026-05-07 | TS-002 (NEXT_PUBLIC env dynamic access) 사고 진단·복구 (commit `2cca009`) |
| 2026-05-07 04:24 (UTC) | LEE sandbox 결제 1건 시도 (₩9,900 standard_monthly) — TS-002 NEXT_PUBLIC 사고 복구 직후 |
| 2026-05-07 04:24 ~ 05:25 | webhook destination URL 오류 + `PADDLE_WEBHOOK_SECRET_SANDBOX` 불일치로 401/4xx 응답 반복 |
| 2026-05-07 05:25 | webhook 흐름 복구 후 정상 도착, 그러나 `paddle_transactions` 미생성 발견 |
| 2026-05-07 (당일) | 진단 — `shouldProcessImmediately` 가 `product_type='subscription'` 분기에서 queue 로 보냄, `processQueue` 가 Cron 가정으로 미처리 |
| 2026-05-07 (당일) | 처방 결정 — 옵션 1 채택 (모든 `transaction.completed` sync) |

(LEE 가 정확한 시각/세부 추가 가능)

---

## 3. Root Cause

### 핵심 원인
- ADR-0010 §4 Hybrid 설계 의도: **one_time = sync, subscription 갱신 = queue (Cron batch 처리)**
- 코드 구현 시 **"subscription 갱신"과 "subscription 첫 결제"를 구분하지 않고** 동일 `transaction.completed` 이벤트로 처리
- `shouldProcessImmediately` 의 `product_type !== 'one_time'` 분기가 **첫 구독 결제까지 queue 로** 보냄
- Cron 워커 미구현 상태 → queue 로 빠진 webhook 영구 미처리

### 코드상 구체 위치
`event-handler.ts:30-63` (변경 전)
```typescript
case "transaction.completed": {
  // ...
  if (mapping?.product_type === "one_time") {
    return { mode: "sync", reason: "nat_purchase_immediate" };
  }
  return {
    mode: "queue",
    reason: mapping ? "subscription_renewal" : "unknown_price_to_queue",
  };
}
```

`processQueue` (line 144-155): `console.log` 만 하고 즉시 return → `dispatchEventHandler` 호출 안 됨 → `markWebhookProcessed` 호출 안 됨.

### 부수 원인 (모니터링 사각지대)
- `paddle_webhooks` 의 `processed_at NULL` + `error NULL` 조합이 **"정상 진행 중인지 미처리인지" 모호**
- queue 로 분기된 webhook 은 throw 자체가 없어 `error` 컬럼도 비어있음
- → 운영자가 누적된 미처리 webhook 을 인지할 신호 없음

### 비대칭 — `subscription.activated` vs `transaction.completed`
| 이벤트 | `shouldProcessImmediately` 결과 | dispatch 도달 여부 |
|---|---|---|
| `subscription.activated` | 무조건 `mode: "sync"` (line 65-66) | ✅ 도달 |
| `transaction.completed` (subscription) | `product_type !== 'one_time'` → `mode: "queue"` | ❌ 미도달 |

같은 결제 1건에서 두 webhook 이 모두 발사되는데 한쪽은 처리되고 한쪽은 안 되는 비대칭. LEE 가 "subscription 은 저장됐는데 transaction 은 row 가 없다" 를 직접 SQL 로 확인하면서 단서 잡음.

---

## 4. Impact

### 발현 환경
- sandbox 검증 단계, **실유저 영향 0**

### 가상 production 영향 (예방된 시나리오)
- 구독자 100 명 시 **100 명 모두 NAT 미충전**
- "NAT 충전 완료" 알림 미발송 (헤더 벨 미표시)
- 사용자 입장: 결제 직후 NAT 잔량 변화 없음 → CS 폭발
- 운영자 입장: `paddle_webhooks` 에 row 는 있는데 처리 흔적 0 → 진단 시간 폭증

### 발견 안 됐을 시 추정 손실
- production 전환 직후 즉시 결제 사고
- 환불 + 신뢰도 타격 + 스토어/PG 신뢰 점수 영향 가능

---

## 5. Resolution

### 채택안 — 옵션 1: 모든 `transaction.completed` sync 처리

`shouldProcessImmediately` 의 `transaction.completed` 분기를 **무조건 sync 반환**하도록 변경.

```typescript
case "transaction.completed":
  // ADR-0010 §4-1 v3 (2026-05-07): 모든 transaction.completed sync 처리.
  return { mode: "sync", reason: "transaction_completed_immediate" };
```

**근거**:
- 핸들러 (`handleTransactionCompleted`) 는 이미 멱등 (`paddle_transactions.status='completed'` 체크)
- 갱신 결제도 LLM/외부 호출 없는 가벼운 처리라 sync 로 충분
- queue 분기 + Cron batch 는 향후 갱신 결제 부하 증가 시 재도입 검토

**ADR 반영**: ADR-0010 §4-1 신설 (Revision History v3, 2026-05-07)

### 5/7 미처리 transaction 복구
- 코드 수정 + 배포 후 **Paddle Sandbox 어드민 → Notifications 로그 → 해당 notification 선택 → "Replay" 버튼**
- 핸들러가 멱등이라 안전하게 재처리
- 이번 작업은 **LEE 가 직접** Paddle 어드민에서 진행 (Claude Code 는 Paddle dashboard 에 권한 없음)

---

## 6. Detection

### 검출 경로
- LEE 의 **수동 SQL 검증** — `paddle_transactions` 비어있음 + `users.coin_balance` 변화 없음 + `paddle_webhooks.processed_at NULL` 발견

### 자동 모니터링 부재
- queue 분기로 빠진 webhook 에 대한 알림 시스템 **0**
- `notifyAdmin` 함수가 `console.error` 만 호출 (현재 구현)
- → 운영자가 정기적으로 SQL 확인하지 않으면 사고 인지 못 함

### 후속 액션 (백로그)
- `paddle_webhooks.processed_at NULL` 누적 카운트 모니터링 (예: `> 5 분` 기준)
- `notifyAdmin` 실제 채널 연결 (Slack 또는 admin notifications 테이블 insert)
- `customer.created` 핸들러 구현 (이번 사고와 별개로 알려진 구멍, 첫 결제 시 user_id 백필 경로)

---

## 7. Follow-up Actions

- [ ] `customer.created` 핸들러 구현 (별개 작업, 우선순위 ↑)
- [ ] `notifyAdmin` 실제 알림 채널 연결 (Slack 또는 admin notifications)
- [ ] `paddle_webhooks` 미처리 누적 모니터링 (cron + 알람)
- [ ] Cron 워커 구축 (queue 재도입 시점 — ADR-0010 §4-1 명시 조건 만족 시)
- [ ] 결제 매핑을 `customData(user_id)` 기반으로 전환 (별도 진행 결정됨)
- [ ] `processed_at NULL` + `error NULL` 조합의 의미 모호성 개선 검토 (예: 명시적 `queued_at` 컬럼 추가)

---

## 8. Lessons Learned

### 1. ADR 설계 의도와 코드 분기 조건의 일치 검증 필요
"subscription 갱신은 queue" 라는 설계가 코드에서 "subscription 모두 queue" 로 잘못 구현됐다. **ADR 텍스트를 코드로 옮길 때 분기 조건을 다시 한 번 짚자.**

### 2. 같은 이벤트 타입이 다른 비즈니스 의미를 가질 때 분기 신중
`transaction.completed` 가 "첫 결제" 와 "갱신 결제" 두 의미를 모두 가지는데, 두 흐름이 다른 처리를 요구한다면 분기 조건이 그 차이를 반영해야 한다. 단순히 `product_type` 으로 가르면 첫 결제까지 같이 빠진다.

### 3. queue + Cron 분리 설계는 Cron 인프라 안정화 후 도입
워커 미구현 상태에서 queue 로 보내면 **영구 미처리** 가 보장된다. 로컬 개발에선 동기 처리만 동작하다가 production 배포 시점에야 발현. **인프라 구축이 먼저, 분기 도입이 나중.**

### 4. NULL/NULL 조합의 모호성 = 모니터링 사각
`processed_at NULL` + `error NULL` 가 "정상 진행 중" 인지 "영구 미처리" 인지 구분 불가. **명시적 상태 컬럼**(`status`, `queued_at`) 또는 별도 테이블 분리가 안전.

### 5. webhook 발사 비대칭의 위험
한 결제 1건이 여러 webhook(`subscription.activated`, `transaction.completed`)을 발사하는데 처리 결과가 비대칭이면 진단이 어렵다. 운영 SQL 점검 시 "한쪽은 됐는데 한쪽은 안 됐다" 가 강한 단서.

### 6. sandbox 검증의 가치
production 전 단계에서 발견되어 실유저 영향 0. **sandbox 라도 end-to-end 검증을 SQL 까지 확인하는 습관**이 사고 예방. UI 만 확인했다면 "결제창 닫혔으니 됐겠지" 로 production 까지 갔을 가능성.

---

## 진단/복구에 사용하는 SQL

### 미처리 transaction 식별
```sql
SELECT id, event_type, processed_at, error, created_at
FROM paddle_webhooks
WHERE event_type = 'transaction.completed'
  AND processed_at IS NULL
ORDER BY created_at DESC;
```

### NAT 잔량 확인
```sql
SELECT id, email, coin_balance
FROM users
WHERE email = '<테스트 이메일>';
```

### `paddle_transactions` row 존재 여부
```sql
SELECT id, user_id, paddle_subscription_id, status, nat_credited, created_at
FROM paddle_transactions
ORDER BY created_at DESC LIMIT 10;
```

### Replay 후 재검증
위 3개 쿼리를 Replay 후 재실행 → `processed_at NOT NULL`, `paddle_transactions` row 생성, `coin_balance` 증가 확인.

---

## Related

- 처방 commit: (작성 시점 기준 직후 commit)
- 사고 유발 코드: `event-handler.ts` (commit `cfbf5d5` 의 paddle 사전 작업 중 도입된 분기 — ADR-0010 §4 의 Hybrid 의도가 첫 결제까지 영향)
- 관련 ADR: [ADR-0010](../adr/ADR-0010-paddle-sandbox-billing.md) §4 (Hybrid 설계), §4-1 (revision)
- 직전 인시던트: [TS-002](TS-002-nextpublic-env-dynamic-access.md) (NEXT_PUBLIC dynamic access) — 같은 paddle wire-up 작업 중 발견
- 백로그: P2-007 (NEXT_PUBLIC dynamic access 잔존 패턴 점검)
