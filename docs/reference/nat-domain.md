# NAT Domain Reference

> Novel Agent NAT 시스템 + 분석 도메인 6 축의 도메인 fact 박제.
> ADR 이 아니라 reference — "왜" 가 아니라 "무엇" 을 박는다.
> 갱신은 결제 도입 / 6 축 변경 / formatDimensionLabel 매핑 변경 등 도메인 사실이 바뀔 때.

- **Last verified**: 2026-05-09
- **Source of truth**: `onehandbook/src/lib/nat.ts`, `onehandbook/src/lib/analysis/dimensionLabel.ts`, `onehandbook/src/app/api/analyze/route.ts`, e2e replication 검증 결과 (단계 4 매트릭스).

---

## NAT 잔량 컬럼

- **위치**: `public.users.coin_balance` (이름은 `nat_balance` 가 아닌 **`coin_balance`** — 초기 도입 당시 명칭 잔존. schema discrepancy 노트 — 변경 시 회귀 영역 큼).
- **타입**: `integer`
- **기본값**: `0`
- **갱신 규약**: 직접 UPDATE 금지 — `consume_nat` / `credit_nat` / `admin_debit_nat` RPC 를 통해서만 변경 (감사 로그 fidelity 보장).
- **예외**: e2e fixture 의 `resetAndCreditNat` 가 reset 단계에서만 직접 `UPDATE coin_balance = 0` 후 `credit_nat` 호출 — production 코드 패턴 아님.

---

## NAT RPC 시그니처

### `consume_nat` (사용자 차감)
- **시그니처**: `(p_amount int, p_ref_type text, p_ref_id bigint, p_metadata jsonb)`
- **호출 권한**: 사용자 컨텍스트 (`auth.uid()` 기반 — 본인 잔량만 차감 가능).
- **반환**: `{ ok: boolean, balance?: number, error?: string }`
- **사용처**: `/api/analyze` 의 background worker 가 LLM 성공 후 호출 (NAT 차감은 동기 응답이 아니라 background 단계에서 발생).
- **e2e 검증**: `e2e/regression/04-analysis-request.spec.ts` test 2 — writer 세션의 `getAuthenticatedClient` helper 로 호출하여 잔량 30 → 29 검증.

```ts
// 호출 패턴 (writerClient = getAuthenticatedClient('writer'))
const { data, error } = await writerClient.rpc('consume_nat', {
  p_amount: 1,
  p_ref_type: 'e2e_test',
  p_ref_id: 0,
  p_metadata: { e2e: true },
});
// data = { ok: true, balance: 29 } 또는 { ok: false, error: 'INSUFFICIENT_NAT' }
```

### `credit_nat` (적립)
- **시그니처**: `(p_user_id bigint, p_amount int, p_reason text, p_ref_type text, p_ref_id bigint, p_metadata jsonb, p_expires_at timestamptz, p_grant_type text)`
- **호출 권한**: `service_role` (사용자 본인 호출 불가 — 결제/어드민/시스템 경로 전용).
- **`p_reason` allowlist** (DB CHECK 제약):
  - `'purchase_credit'` — 결제로 충전
  - `'refund'` — 환불
  - `'bonus'` — 보너스 / 이벤트 / e2e seed
  - `'admin_adjust'` — 어드민 조정
  - `'manual_adjust'` — 수동 조정
  - `'other'` — 기타
- **`p_grant_type`**: `'bonus' | 'purchase'` (관찰됨 — 회계 분류용. 자세한 enum 은 ADR-0011 참조).
- **반환**: `{ ok: boolean, error?: string }` — validation 실패 시 SQL exception 이 아니라 JSON body 의 `ok: false` 로 반환되므로 호출 측이 `data.ok` 도 검사해야 함.
- **사용처**: 결제 완료 후 / 보너스 지급 / e2e fixture 시드.
- **e2e 사용**: `e2e/fixtures/auth.ts:resetAndCreditNat` — `p_reason: 'bonus'`, `p_grant_type: 'bonus'`, `p_metadata: { e2e_seed: true }`.

```ts
// 호출 패턴 (admin = getAdminClient())
const { data: creditData, error } = await admin.rpc('credit_nat', {
  p_user_id: userId,
  p_amount: 30,
  p_reason: 'bonus',
  p_ref_type: 'e2e_test',
  p_ref_id: 0,
  p_metadata: { e2e_seed: true },
  p_expires_at: null,
  p_grant_type: 'bonus',
});
if (creditData?.ok === false) throw new Error('credit_nat rejected');
```

### `admin_debit_nat` (어드민 차감)
- **시그니처**: `(p_user_id bigint, p_amount int, p_admin_reason text, p_admin_auth_id uuid, p_metadata jsonb)` (pronargs: 5)
- **호출 권한**: `service_role` + 어드민 컨텍스트 (어드민 페이지 경로에서만 호출).
- **반환**: `{ ok: boolean, error?: string }` (관찰됨, credit_nat 와 동일 패턴 추정)
- **사용처**: 어드민이 수동으로 사용자 NAT 차감 (예: 환불 거부, 부정 사용 처분).
- **e2e**: 미사용 — schema replication 매트릭스에서 함수 시그니처 동기화 확인용으로만 등장.

---

## NAT 과금 규칙 (2026-05 기준, `src/lib/nat.ts`)

### 단일 회차 분석 (`natBaseCostByLength`)
| 글자 수 | 기본 NAT |
|---|---|
| 6,000 자 이하 | 1 |
| 6,001 ~ 10,000 자 | 2 |
| 10,001 자 이상 | 3 |

> 글자 수 = `[...text].length` (유니코드 코드 포인트, 이모지 1 자).

### 옵션 가산 (단일 회차)
- `includeLore` (세계관·인물 설정 포함): **+1 NAT**
- `includePlatformOptimization` (플랫폼 최적화 — 카카오/문피아/네이버): **+1 NAT**

### 일괄 분석 — 회차별 합산 (`buildBatchNatBreakdown`)
- 기본 = 선택된 회차 각각의 글자수 구간 NAT 합.
- 옵션은 **회차당 +1 NAT × 회차 수**.

### 통합(holistic) 분석 (`computeHolisticNatCost`)
- 기본 = **회차당 1 NAT** (글자수 무관, 회차 수 기준).
- 옵션은 **통합 1 회당 +1 NAT** (회차 수 무관).

### 다청크 통합 (10 화 초과, `computeHolisticChunkNatCost`)
- 각 청크 기본 = 청크 내 회차 수 × 1 NAT.
- 옵션은 **첫 청크에만** 가산 (전체 작업당 1 회).
- 청크 ≥ 2 시 병합 NAT = **+2 NAT** (`computeHolisticMergeNatCost`).

> 자세한 결정 배경은 ADR-0001 / ADR-0011 참조.

---

## 분석 도메인 — `formatDimensionLabel` 매핑

> Source: `src/lib/analysis/dimensionLabel.ts`
> 동작: 한글 키는 그대로 통과 (`/[가-힣]/.test(k)`) → 영어 snake_case 는 매핑 → 미매핑은 `_` → space 폴백.

### EN → KO 매핑 (19 개, 2026-05-09 측정)

| snake_case 키 | 한글 라벨 |
|---|---|
| `plot_engagement` | 플롯 몰입도 |
| `writing_quality` | 문장·작법 |
| `character_appeal` | 인물 매력 |
| `romance_potential` | 로맨스·감정선 |
| `premise_originality` | 설정·소재 독창성 |
| `commercial_viability` | 상업성·흥행력 |
| `immersion` | 몰입도 |
| `pacing` | 전개·호흡 |
| `hook_strength` | 첫 훅·몰입 |
| `worldbuilding` | 세계관 |
| `character_consistency` | 캐릭터 일관성 |
| `world_setting_accuracy` | 세계관 고증 |
| `character_setting_consistency` | 캐릭터 일관성 |
| `relationship_usage` | 인물 관계 활용도 |
| `relationship_utilization` | 인물 관계 활용도 |
| `dialogue_quality` | 대사·대화 |
| `tension` | 긴장감 |
| `originality` | 독창성 |
| `readability` | 가독성 |

### "6 축" 의 실체
- **고정 6 축이 아님** — 매핑 테이블은 19 개 키를 보유. 신규 분석 프롬프트는 한글 키를 직접 쓰도록 유도 (이 매핑은 **과거 영어 키 호환용**).
- **e2e 시드 mock 6 축** (`e2e/fixtures/seed.ts:DEFAULT_MOCK_RESULT`) 은 다음 6 키만 박음:
  - `hook_strength` (기본 80) → "첫 훅·몰입"
  - `character_appeal` (기본 78) → "인물 매력"
  - `worldbuilding` (기본 76) → "세계관"
  - `tension` (기본 82) → "긴장감"
  - `romance_potential` (기본 79) → "로맨스·감정선"
  - `originality` (기본 75) → "독창성"
- 이 6 키는 e2e mock 한정 — 실제 LLM 응답의 키 집합은 프롬프트/장르에 따라 달라질 수 있음 (검증 안 됨).

---

## `analysis_runs.result_json` 스키마 (관찰됨)

```jsonc
{
  "overall_score": 78,                    // number
  "dimensions": {                         // formatDimensionLabel 로 한글 변환
    "hook_strength": { "score": 80, "comment": "..." },
    "character_appeal": { "score": 78, "comment": "..." },
    // ... 키 집합은 프롬프트/장르에 따라 가변
  },
  "improvement_points": [ "..." ],        // string[]
  "summary": "...",                       // string
  // (e2e 한정) "e2e_seed": true
}
```

> 추가 키 (예: `strengths`, `executive_summary`, `episode_scores` 등 — 통합 분석) 는 `src/lib/ai/holisticPrompts.ts` / `holisticMergePrompts.ts` 참조. 미확인 영역.

---

## `analysis_jobs.status` CHECK 제약

- **enum 4 개**:
  - `'pending'` — 작업 생성 직후
  - `'processing'` — worker 가 LLM 호출 중
  - `'completed'` — 분석 결과 + NAT 차감 완료
  - `'failed'` — LLM 실패 / 검증 실패 / NAT 부족 등
- **DB 제약**: `NOT NULL` + `CHECK (status IN ('pending','processing','completed','failed'))`
- **TypeScript literal**: `e2e/fixtures/seed.ts:seedAnalysisJob` 의 `status` 파라미터.
- **pending hard expiry**: 12 분 (CLAUDE.md 참조 — worker 가 픽업 안 하면 expired 처리).

---

## `/api/analyze` 응답 형식

> Source: `src/app/api/analyze/route.ts` (snake_case 응답)

### 성공 (200)
```json
{ "job_id": "uuid-string", "required_nat": 1 }
```
- `job_id`: `analysis_jobs.id` (uuid).
- `required_nat`: 차감 예상 NAT (실 차감은 background worker 에서 발생).

### NAT 부족 (402)
```json
{ "code": "INSUFFICIENT_NAT", "error": "..." }
```

### 기타 에러
- 400 / 404 / 500 (확인 안 됨 — 관찰 시 갱신).

---

## 관련 commit / ADR 인용

- **ADR-0001**: NAT 토큰 하이브리드 과금 모델 — NAT 가격 / 충전 단위 결정.
- **ADR-0011**: NAT 회계 분류 (paid/bonus) + 유효기간 5 년 — `p_grant_type` enum.
- **ADR-0019**: E2E spec 계층 분리 — NAT pipeline 검증 패턴 (spec 04 의 3-test 구조).
- **commit 247969b**: STEP 0 진단 — `coin_balance` ↔ `nat_balance` schema discrepancy 노트.
- **commit (e2e fixture 보강)**: `e2e/fixtures/auth.ts:resetAndCreditNat` 도입 — credit_nat allowlist 적용.
- **commit (spec 04)**: `e2e/regression/04-analysis-request.spec.ts` — consume_nat RPC 직접 호출 패턴.

---

## 향후 갱신 시점

- **결제 도입 (Phase 3a)** 시 `p_reason` allowlist 변경 가능성 (`'paddle_purchase'` 등 추가될 가능성).
- **분석 도메인 키 변경** 시 — LEE 가 프롬프트에서 새 한글 키 도입하면 `formatDimensionLabel` 매핑은 영어 호환용으로만 남음 (현재 이미 그 흐름).
- **`coin_balance` → `nat_balance` 컬럼 rename** 검토 시 — 회귀 영역 매우 큼. 이 reference 가 변경 영향 영역 점검 시작점.
- **NAT 과금 구간 변경** 시 — 6,000 / 10,000 자 경계 또는 옵션 +1 NAT 정책. `src/lib/nat.ts` 의 `natBaseCostByLength` / `computeNatCost` 와 본 doc 동기화.
