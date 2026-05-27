# Paddle 결제 연동 재개 핸드오프 (2026-05-26)

> 이 문서는 새 Claude 세션이 Paddle Sandbox 결제 연동을 이어서 진행하기 위한 핸드오프 문서.
> 현재까지 진행된 사실 영속화 + 다음 단계 작업 의제 정리.
> 마지막 paddle commit 이후 19일 공백 (2026-05-07 → 2026-05-26).

---

## §0. 진입 사실 우선순위

새 세션 시작 시 다음 5 항목을 우선 read:
1. **본 문서 (handoff-2026-05-26)** — 전체 컨텍스트
2. **`docs/adr/ADR-0010-paddle-sandbox-billing.md`** — Paddle 연동 결정 (v3, 2026-05-07)
3. **`docs/troubleshooting/TS-002`, `TS-003`** — paddle wire-up 중 발생한 2 인시던트
4. **`CLAUDE.md` (OHB 루트)** — 프로젝트 정책 + Claude Code 가이드
5. **commit log** `git log --oneline --all | grep -iE "paddle"` — paddle 관련 commit history

---

## §1. 현재 작업 상태

### Phase
- ADR-0010 **Phase 3a (Sandbox) Step 3-4 중간** — 핵심 핸들러 2건 구현 + TS-003 처방 후 **재검증 미수행** 상태

### 최근 Paddle 관련 commit (6건, 2026-04-29 ~ 2026-05-14)
```
7b60039 2026-05-14 fix(pricing/login): remove error code from alert + /login → / redirect (2-D-8-2.6)
81825ea 2026-05-14 feat(pricing): /pricing 시안 정합 + 5 컴포넌트 신설 (2-D-8-2.5)
cdf5c99 2026-05-07 fix(paddle): 모든 transaction.completed sync 처리 + ADR-0010 v3 + TS-003
2cca009 2026-05-07 fix(paddle): NEXT_PUBLIC_* 변수를 literal access 로 변경 (TS-002)
c514695 2026-05-06 feat(paddle): /pricing 스탠다드 카드 결제 버튼 wire-up
cfbf5d5 2026-05-03 feat(paddle): 결제 연동 사전 작업 (Step 3-4)
70195ca 2026-04-29 feat(paddle): handleTransactionCompleted with NAT credit (Step 3-4-A)
9a1413b 2026-04-29 feat(paddle): scaffold sandbox webhook pipeline and update verify-copy
```

### 공백 사실
- **2026-05-07 cdf5c99 (TS-003 처방) 이후 paddle commit 0건** — 19일 공백
- TS-003 처방 (queue trap → 전부 sync) 적용 후 **재테스트 흔적 없음**
- 그 사이 본 채널은 Phase 2-D 시리즈 (UI 시안 적용 스프린트) 작업 중

### LEE 기억 사실 (2026-05-26 본 세션)
- "웹훅 신호가 안 왔었다"
- 정확히는: 2026-05-07 sandbox 결제 1건 시도 (₩9,900) → webhook destination URL 오류 + secret 불일치로 401 반복 → 복구 후 webhook 도착 했으나 `paddle_transactions` 미생성 (TS-003 root cause: queue trap) → 처방 후 미재검증

---

## §2. 운영 코드 ↔ DB 정합 사실 (이미 구축된 것)

### DB (production Supabase `ystxvlibeqdrlnsriidh`)
적용된 migration 3건:
- `20260428160000_paddle_billing_phase3a.sql` — `paddle_webhooks`, `paddle_price_nat_mapping`, `paddle_transactions`, `users.paddle_customer_id` 신규
- `20260428170000_paddle_billing_phase3a_policies.sql` — RLS policies
- `20260430180000_paddle_subscriptions.sql` — `paddle_subscriptions` 신규 + `paddle_price_nat_mapping` FK 연결

### `paddle_price_nat_mapping` seed (sandbox)
- `pri_01kq4a0q6a25n4fsd8frdjva2e` → standard_monthly (subscription, NAT amount = seed 값 1건)
- production seed 미존재

### 코드 (`src/lib/paddle/` + `src/app/api/paddle/`)
| 파일 | 상태 |
|---|---|
| `client.ts` (`openCheckout`) | ✓ Paddle.js initialize + checkout open |
| `config.ts` (`PADDLE_PRICES`, `getPaddleServerConfig`) | ✓ 환경변수 literal access (TS-002 처방) |
| `webhook-verify.ts` | ✓ HMAC-SHA256 + timestamp |
| `event-types.ts` + `event-handler.ts` | ✓ 13 event_type 타입 가드 + sync/queue 분기 |
| `handlers/handle-transaction-completed.ts` | ✓ 멱등 + price 매핑 조회 + `credit_nat` RPC 호출 |
| `handlers/handle-subscription-activated.ts` | ✓ 첫 구독 NAT 충전 |
| `app/api/paddle/webhook/sandbox/route.ts` | ✓ 서명 검증 + 멱등 upsert + `waitUntil` 백그라운드 분기 |
| `app/pricing/StandardPlanButton.tsx` | ✓ `openCheckout(PADDLE_PRICES.STANDARD_MONTHLY)` wire 완료 |

### 환경변수 (Vercel + .env.local)
- `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<sandbox-frontend-v1>`
- `NEXT_PUBLIC_PADDLE_PRICE_STANDARD_MONTHLY=pri_01kq4a0q6a25n4fsd8frdjva2e`
- `PADDLE_API_KEY_SANDBOX`
- `PADDLE_WEBHOOK_SECRET_SANDBOX`

---

## §3. 진행되어야 했지만 미완 / 미검증인 사항

### A. 재검증 미수행 (가장 큰 미완)
2026-05-07 TS-003 처방 commit `cdf5c99` 이후 **실 sandbox 결제 1건도 시도하지 않음**.

확인 필요한 항목:
- [ ] `/pricing` → 「구독하기」 클릭 → Paddle checkout overlay open
- [ ] 결제 완료 → webhook 도착 → `paddle_webhooks` row INSERT + `processed_at` not null
- [ ] `paddle_transactions.status='completed'` + `nat_credited=true`
- [ ] `users.coin_balance` 증가 + `coin_logs` row (`reason='purchase_credit'`)
- [ ] `users.paddle_customer_id` 매핑 (customer.created 또는 transaction.completed 시점)

### B. TODO 주석 4건 (Step 3-4 후속)
| 파일:line | 내용 |
|---|---|
| `event-handler.ts:153` | `customer.created` handler 미구현 (현 `console.log` 만) |
| `event-handler.ts:161` | 보안 이벤트 5종 handler 미구현 (api_key.* / client_token.revoked) |
| `handle-transaction-completed.ts:280` | 미매핑 price_id 시 어드민 알림 (슬랙 또는 `notifications`) 미연결 |
| `handle-subscription-activated.ts:123` | 구독 활성화 시 어드민 알림 미연결 |

### C. Queue 이벤트 5종 처리기 부재
`event-handler.ts` 의 `processQueue` 는 row 적재만 하고 Cron 가정. **Cron 워커는 구축 안 됨**.

queue 대기 이벤트:
- `transaction.payment_failed`
- `subscription.canceled`
- `subscription.past_due`
- `subscription.updated`
- `adjustment.created`

→ 현재 이 5종 webhook 이 도착하면 `paddle_webhooks` 에 적재만 되고 `processed_at IS NULL` 영구 정체.

### D. NAT 추가 패키지 미연동
- CLAUDE.md 비즈니스 모델: NAT 추가 구매 = 50 NAT 4,900원 / 100 NAT 8,900원 / 200 NAT 15,900원
- 현재 Paddle price 등록 = `standard_monthly` 단 1건 (구독)
- 추가 NAT 패키지 (one_time) Paddle price + DB mapping 모두 미생성

### E. Production destination 미준비
- ADR-0010 §3-1: `/api/paddle/webhook/production/route.ts` Phase 3c 활성화 예정 → **코드 미작성**
- production seed migration 미작성

---

## §4. 다음 단계 작업 의제 (권장 순서)

### Step 1. 환경 사실 점검 (작업 전 30분)
- [ ] Vercel env vars 5종 (§2-환경변수) 현재 값 유효 확인 (LEE 콘솔)
- [ ] Paddle Sandbox dashboard → Webhook destination URL 확인 (`<vercel-url>/api/paddle/webhook/sandbox`)
- [ ] Paddle Sandbox dashboard → Webhook secret 과 `PADDLE_WEBHOOK_SECRET_SANDBOX` 일치 확인
- [ ] `paddle_price_nat_mapping` 현 row 확인 (`SELECT * FROM paddle_price_nat_mapping`)

### Step 2. e2e 재검증 (TS-003 처방 사후 검증)
1. Paddle Sandbox dashboard → "Send test event" 로 `transaction.completed` 1발 전송 → `paddle_webhooks` INSERT 확인
2. 실제 sandbox 결제 1건 (test card) → webhook 도착 → NAT 충전까지 e2e 동작 확인
3. **확인 SQL**:
   ```sql
   SELECT id, event_type, processed_at, error FROM paddle_webhooks ORDER BY received_at DESC LIMIT 5;
   SELECT id, status, nat_credited, nat_amount FROM paddle_transactions ORDER BY created_at DESC LIMIT 5;
   SELECT coin_balance FROM users WHERE id = <test_user_id>;
   SELECT * FROM coin_logs WHERE reason = 'purchase_credit' ORDER BY created_at DESC LIMIT 5;
   ```

### Step 3. NAT 추가 패키지 (one_time) 연동
ADR-0010 §5-3 운영 룰 **필수 준수** (price 생성 전 매핑 migration 선행):
1. migration 작성: `paddle_price_nat_mapping` INSERT 3건 (50/100/200 NAT, `product_type='one_time'`)
2. migration 적용 (LEE Studio SQL Editor)
3. Paddle Sandbox dashboard → 3개 price 생성 (4,900 / 8,900 / 15,900 KRW)
4. dashboard 의 실제 price_id → migration 의 placeholder 와 일치하는지 확인
5. `/pricing` 에 NAT 패키지 카드 3개 추가 (시안 `design_novel/novel-agent/pricing.jsx` 확인 선행)
6. e2e 결제 테스트 3건

### Step 4. Queue 이벤트 5종 처리
**옵션 분기 (LEE 결정 의제)**:
- **옵션 1**: Cron 워커 구축 (Vercel Cron) — `paddle_webhooks WHERE processed_at IS NULL` 1분 주기 처리
- **옵션 2**: queue 분기 폐기, 5종도 sync 처리 (TS-003 v3 처방 패턴 확장)
- **옵션 3**: 본 5종은 알림용으로만 처리 (NAT 영향 없으므로 어드민 notifications 발송만)

→ 권장: **옵션 3 → 추후 옵션 1** (CS 부담 최소 + 인프라 부담 회피)

### Step 5. TODO 주석 해소 (어드민 알림)
- `customer.created` → `users.paddle_customer_id` 자동 매핑
- 미매핑 price_id / 구독 활성화 / 보안 이벤트 → `notifications` insert + 어드민 채널 알림

### Step 6. Phase 3b (Staging) 준비 (선택)
- ADR-0010 §14 Phase 3a Exit Criteria 4건 충족 확인
- ADR-0011 (Phase 3b Staging) 작성

---

## §5. 미해결 의제 / 리스크

### R-1. Phase 2-D 누적 push 와 paddle 작업 충돌
- 현재 branch `feat/design-phase-2` 에 19~20 commit 누적 (paddle 무관 UI 작업)
- paddle 작업 재개 시 별도 branch 분리 권장 (예: `feat/paddle-resume`)
- 또는 Phase 2-D push 완료 후 paddle 작업 (LEE 결정 의제)

### R-2. Compliance 미해결
- ADR-0010 §8: Production 활성화 = LEE 실업급여 종료 + 사업자 등록 + 세무사 선임 후
- 현재 LEE 개인(sole proprietor) 검수만 통과 상태
- **Phase 3a/3b 는 sandbox 만** — 본 핸드오프 범위 전체가 sandbox

### R-3. CLAUDE.md 표기 갭
- CLAUDE.md 의 "다음 의제 → 그 외 예정 → Paddle 결제 연동 (사업자 등록 후)" 표기는 **production 전환** 기준
- sandbox 검증/완성도는 본 문서가 정본
- 본 작업 재개 commit 시 CLAUDE.md "현재 작업 상태" 섹션에 paddle Phase 3a 진행 라인 추가 필요

### R-4. NAT 추가 패키지 시안 부재 가능성
- `/pricing` 시안 (`design_novel/novel-agent/pricing.jsx`) 에 NAT 추가 패키지 카드가 포함되어 있는지 미확인
- Step 3 진입 전 시안 직접 read 후 진행 (CLAUDE.md 시안 직접 확인 의무)

---

## §6. 참고 문서

### ADR
- `docs/adr/ADR-0001-nat-token-model.md` — NAT 토큰 모델 결정
- `docs/adr/ADR-0004-payment-go-no-go.md` — production 활성화 Go/No-Go
- `docs/adr/ADR-0008-notifications-unification.md` — 어드민 알림 채널
- `docs/adr/ADR-0009-phase-3-payment-roadmap.md` — Phase 3 전체 로드맵
- **`docs/adr/ADR-0010-paddle-sandbox-billing.md`** — Paddle Sandbox 결제 (v3, 본 작업 정본)

### Troubleshooting
- `docs/troubleshooting/TS-002-nextpublic-env-dynamic-access.md` — NEXT_PUBLIC env client bundle 미인라인 사고
- `docs/troubleshooting/TS-003-subscription-transaction-queue-trap.md` — queue trap NAT 미충전 사고

### 시안
- `design_novel/novel-agent/pricing.jsx` — /pricing 시안 (Step 3 진입 전 read)

---

## §7. 본 채널 누적 게이트 적용 (CLAUDE.md §본 채널 누적 게이트 10건)

본 작업 진행 시 특히 주의할 게이트:
- **#1 runtime 사실 검증**: 코드 read 만으로 webhook 정상 동작 단정 금지 → 실제 Paddle 콘솔 send test event 결과로 검증
- **#3 Supabase 동작 사실**: `paddle_*` 테이블 RLS / FK 동작은 본 채널 read 만으론 미검증 → SQL 직접 실행
- **#8 권한 사실 사전 점검**: migration 적용 권한 = LEE Studio SQL Editor manual run only
- **#9 DB schema ↔ 코드 commit 분할 갭**: 신규 price 추가 시 migration → Paddle dashboard 순서 엄수 (ADR-0010 §5-3)

---

## 본 세션 (2026-05-27) 결과 보충

본 핸드오프 작성 (2026-05-26) 직후 2026-05-27 세션에서 진단 + 처방 + 검증 완료. 상세 사실 = `docs/adr/ADR-0028-paddle-price-id-root-cause-and-p4-fallback.md`.

### 본 핸드오프 의제 진행 사실

- **§3-A (재검증 미수행)**: 본 세션에서 진행 완료. silent fail 재현 → root cause 재정의 → 처방 검증 모두 종료.
- **§3-B (TODO 주석 4건)**: handle-subscription-activated 의 customer 매핑 = P4 fallback 으로 보완 (commit `0761860`). 다른 TODO 3건은 잔존:
  - customer.created handler (event-handler.ts:153 TODO)
  - 보안 이벤트 5종 처리
  - 미매핑 / 구독 활성화 어드민 알림
- **§3-C (Queue 이벤트 5종)**: 사실 그대로 잔존 (의제 4 잔존). 옵션 결정 의제: Cron / sync 확장 / 알림만.
- **§3-D (NAT 추가 패키지 10/30/100)**: 사실 그대로 잔존. LEE 시안 정합 = paddle_price_nat_mapping 미적용 + Paddle 측 신규 price 생성 의제.
- **§3-E (Production destination)**: 사실 그대로 잔존. ADR-0004 Go/No-Go 직전 의제.

### Root Cause 재정의 사실 (본 핸드오프 §3 가정 정정)

본 핸드오프 §3 의 root cause 가정:
- TS-003 처방 잔재 / 신호 갭
- price_id 추출 갭 가능성 일부 식별 (정확한 path 미확정)
- 가설 P1~P5 분기 제시

실제 root cause 사실:
- price_id 추출 path 갭 (`items[0].price_id` ↔ `items[0].price.id`) — P3 가설 정합 + 정확한 코드 위치 식별
- TS 정의 갭 (`PaddleTransaction.items` = 단축 / `PaddleSubscription.items` = nested) 사실 동시 발견
- 본 핸드오프 가설 P1 (TS-003 처방 잔재) = 부분 정합 (sync 강제 + 사실은 OK, 단 handler 내부 throw 가 동일 silent fail 유발)
- 가설 P4 (customer mapping path 갭) = 별도 사실 (P4 처방 무효화 아님, 부수 처방으로 영속화)

### Commit history (본 세션 5건)
- `819a08b` — LEE-only E2E 진입점
- `f6c68b8` — P4 fallback (transaction)
- `82f67ae` — root cause: price_id nested path fix
- `0761860` — P4 fallback (subscription)
- `c6c3deb` — TopBar + 홈 Link
- → main 머지: `c24cc35` (PR #11)

### 정리 사실 (2026-05-27 03:14 KST)
- paddle_webhooks: 22 marked + 7 processed + 0 pending = 29
- paddle_subscriptions: 6 canceled + 0 active
- paddle_transactions: 1 (NAT credit 검증 결과 보존)
- user 1: coin_balance 1050 / paddle_customer_id `ctm_01kskcxq...`

### 본 세션 안 발견된 추가 사실 (영속 메모)

#### web_search 결과 — Paddle Customer Portal + Cancel API 사양 확정
의제 9~11 (마이페이지 통합) 진입 전 사양 확보 완료:
- Customer Portal session API: `POST /customers/{customer_id}/portal-sessions` + `subscription_ids` 배열 → 인증된 일회용 portal URL (Paddle hosted)
- Paddle.js Update Payment Method: `get a transaction to update payment method` API → `txn_*` ID → Paddle.js Checkout overlay
- Cancel subscription API: `POST /subscriptions/{id}/cancel` 기본 = 다음 결제일 cancel (scheduled_change), `effective_from: "immediately"` 시 즉시 cancel
- Update subscription API: 플랜 변경 + `proration_billing_mode` 옵션 (`do_not_bill` / 즉시 청구 등)
- Cancellation Flows: customer portal 안 자동 포함 사실

#### SaaS 결제 UX 표준 사실
LEE 의제 정합 사실: 결제 페이지의 의도적 이탈 격리 = 일반 SaaS UX 표준. `/pricing` 의 LeftRail 부재 / 좌측 로고 부재 = 갭이 아닌 의도된 사양. 향후 마이페이지 결제 영역 작업 시 동일 가정 적용.

### 잔존 의제 (다음 세션, 우선순위 권장)
| 순위 | 의제 | 비고 |
|---|---|---|
| 1 | 의제 9 (Customer Portal session) | 시안 사실 보고 후 진입 |
| 2 | 의제 2 (구독 해지 API + UI) | 의제 9 와 통합 또는 별도 |
| 3 | 의제 4 (Queue 5종 처리) | 의제 2 와 결합 결정 |
| 4 | 의제 10 (플랜 변경) | 의제 9 와 통합 |
| 5 | 의제 11 (결제 내역) | DB 직접 (paddle_transactions) |
| 6 | 의제 1 (갱신 테스트) | Paddle Sandbox time machine 사실 추가 확인 |
| 7 | 의제 5 (customer.created handler) | 부가 |
| 8 | 의제 12 (E2E 진입점 제거) | production 진입 직전 |

---

**End of handoff-2026-05-26-paddle-billing-resume.md**
