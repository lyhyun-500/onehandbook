# ADR-0005: Next.js 서버 컴포넌트 ↔ 클라이언트 컴포넌트 경계에서의 useState 초기화 함정 대응

**Status**: Accepted
**Date**: 2026-04-23
**Author**: LEE
**Implementer**: Claude Code (진단 + 수정)
**Reviewer**: 웹 Claude (설계 검토)
**Context**: Novel Agent / 어드민 유저 관리 페이지 필터 버그
**Related**: ADR-0003 (어드민 위치)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-23 | 초안 — 버그 발견 + 2가지 수정 옵션 비교 + key 리마운트 채택 |

---

## 1. Context (배경)

### 버그 증상
`/admin/users` 페이지에서 검색/필터 동작 불일치:

| 레이어 | 상태 |
|-------|-----|
| URL | `?provider=naver` ✅ (정상 반영) |
| Network 요청 | `GET /api/admin/users?provider=naver` ✅ (정상) |
| 서버 응답 | 필터된 5명 반환 ✅ (정상) |
| **UI 렌더링** | **필터 전 10명 그대로** ❌ (버그) |

### 발견 경위
- 어드민 MVP 구축 후 로컬 테스트 중
- RLS 수정 작업 후 필터 버그 동시 발견
- 네트워크 요청은 정상인데 화면만 반영 안 되는 이상한 증상

### 원인 확정
`src/components/admin/UsersListView.tsx` 의 상태 초기화 패턴:

```typescript
const [rows, setRows] = useState<AdminUserListItem[]>(props.initialUsers);
const [total, setTotal] = useState(props.initialTotal);
const [page, setPage] = useState(props.initialPage);
```

React 의 `useState(initialValue)` 는 **최초 마운트 1회 만** 초기값을 읽음.
이후 props 가 바뀌어도 내부 state 는 재초기화되지 않음.

### Next.js App Router 의 특이 동작
```
1. 필터 변경 → router.push('/admin/users?provider=naver')
2. 같은 라우트, 같은 컴포넌트 → 언마운트 안 함
3. 서버 컴포넌트(AdminUsersPage) 재실행 → 새 props 전달
4. UsersListView 의 rows state 는 여전히 최초 10명 → 화면 변화 없음
5. URL, 네트워크는 정상 = 서버 측은 정상, 클라 상태만 동기화 안 됨
```

**이게 가장 주요한 버그**이며, 부수적으로 `provider`/`status`/`sort` state 도 같은 방식으로 초기화돼 **URL ↔ UI select 값 어긋남** 문제도 동반.

---

## 2. Decision (결정)

**옵션 A — `key` prop 기반 강제 리마운트** 채택.

### 구체 구현
`src/app/admin/users/page.tsx` 에서 UsersListView 사용 시 `key` prop 추가:

```tsx
<UsersListView
  key={`${input.provider}-${input.status}-${input.sort}-${input.search}`}
  initialUsers={result.users}
  initialTotal={result.total}
  initialPage={result.page}
  query={input}
/>
```

### 동작
- 필터 변경 시 key 문자열이 바뀜
- React 는 key 가 바뀌면 **컴포넌트를 언마운트 후 재마운트**
- 재마운트 시 `useState(props.initialUsers)` 가 새 props 로 재초기화
- 결과: UI 가 서버 응답과 동기화됨

---

## 3. Alternatives Considered

### 옵션 A — key 기반 리마운트 ⭐ 채택
```
장점:
- 1줄 수정
- 이해 쉬움 (코드 리뷰 친화)
- useState 로직 그대로 유지 (내부 로직 수정 불필요)
- 실수 여지 없음

단점:
- 필터 변경 시 전체 컴포넌트 리마운트
- 스크롤 위치 리셋
- 입력 focus 리셋
- "더보기" 히스토리 리셋
```

### 옵션 B — useEffect 로 props → state 동기화
```typescript
useEffect(() => {
  setRows(props.initialUsers);
  setTotal(props.initialTotal);
  setPage(props.initialPage);
}, [props.initialUsers, props.initialTotal, props.initialPage]);

장점:
- 스크롤/focus 유지
- 더 정교한 제어
- 부분 업데이트 가능

단점:
- useEffect 의존성 배열 실수 가능
- 무한 루프 리스크 (dropdown → state → effect → props → ...)
- 코드 라인 증가
- 렌더 사이클 한 번 낭비 (마운트 → 효과 발화 → 재렌더)
```

### 옵션 C — 완전 상태 끌어올리기 (상태 전부 URL 에 의존)
```
방식:
- UsersListView 를 controlled component 로 변경
- 모든 state 를 useSearchParams() + router.push() 로 URL 에 저장
- 내부 state 제거

장점:
- URL 이 single source of truth
- 뒤로가기 / 북마크 친화적

단점:
- 리팩터링 범위 큼 (5+ 파일)
- 타이핑 중 URL 업데이트 시 성능 이슈
- "더보기" 페이지네이션 설계 복잡
```

---

## 4. EV Analysis

> 공식: **E = P(win) × Gain − P(loss) × Loss**

### 옵션 A — key 리마운트 ⭐
```
P(win)   = 0.95
근거:    React 기본 메커니즘, 실수 여지 최소

Gain:
- 1줄 수정, 5분 작업
- 디버깅 쉬움

Loss:
- 스크롤/focus 리셋 UX 비용
  → 어드민 빈도 낮은 작업이라 사실상 무시 가능

EV ≈ 강한 양수
```

### 옵션 B — useEffect 동기화
```
P(win)   = 0.75
근거:    의존성 배열 실수 시 버그 가능 (실제로 경험 많음)

Gain:
- 스크롤/focus 유지
- 부분 업데이트 효율성

Loss:
- 무한 루프 발생 시 디버깅 시간
- 코드 복잡도 증가

EV ≈ 양수 (A 보다 낮음)
```

### 옵션 C — 완전 URL 동기화
```
P(win)   = 0.6
근거:    리팩터링 범위 크고 엣지 케이스 많음

Gain:
- 북마크/뒤로가기 친화적
- 상태 투명성

Loss:
- 5+ 파일 수정
- "더보기" 재설계
- 입력 중 URL 빠르게 업데이트 시 성능

EV ≈ 약한 양수
```

### 비교

| 옵션 | EV | P(win) | 작업 규모 | UX 영향 |
|-----|----|--------|---------|--------|
| **A key** | **강한 양수** | **0.95** | **1줄** | **미미** |
| B useEffect | 양수 | 0.75 | 3~5줄 | 긍정 |
| C URL 동기화 | 약한 양수 | 0.6 | 5+ 파일 | 긍정 |

---

## 5. Revisit Criteria

이 결정을 재검토할 조건:

### 옵션 B 로 전환 고려
- 유저 관리 페이지에서 **입력 중 자동 검색** 도입 (실시간 타이핑 반영)
- 스크롤이 긴 리스트 (300+ 유저) 에서 필터 후 돌아가는 UX 요구

### 옵션 C 로 전환 고려
- CS 담당자 영입 → 작업 중 URL 공유 필요
- 북마크/즐겨찾기 기능 요청

**현재 어드민 운영 규모 (유저 수 10~100명, LEE 1인) 에서는 옵션 A 가 최적**.

---

## 6. Consequences

### Positive
- 최소 수정으로 버그 해결
- useState 로직 그대로 유지
- 코드 리뷰 비용 낮음
- 다른 어드민 페이지 (문의/탈퇴) 에서도 같은 패턴 재사용 가능

### Negative
- 필터 변경 시 "더보기" 로 append 된 데이터 손실 (재로드 필요)
  → 현재 어드민 규모에선 무시 가능
- 입력 중 focus 리셋 — 근데 검색은 엔터/버튼 트리거라 실제 영향 없음

### Neutral
- 소비자 사이트 (Cursor 담당 영역) 에는 적용 안 함
  → 소비자 사이트는 무한 스크롤 + 실시간 필터 등 다른 패턴 필요 가능

---

## 7. Implementation Notes

### 수정 파일
`onehandbook/src/app/admin/users/page.tsx` (1줄 추가)

### 구현 커밋
```
fix(admin): force remount UsersListView on filter change

router.push 로 쿼리스트링만 바뀌면 같은 컴포넌트 인스턴스가 유지돼
useState(props.initialUsers) 로 최초 마운트 때 잡은 rows 가 서버의
새 필터 결과로 교체되지 않는 문제. query 조합을 key 로 넘겨 필터
변경 시 강제 리마운트하도록 수정.
```

### 검증 포인트
- ✅ 필터 변경 → 화면 즉시 재렌더
- ✅ URL ↔ select 값 동기화 (리마운트로 재초기화)
- ✅ "더보기" append 는 같은 인스턴스 내부이므로 그대로 유지

---

## 8. Related Future ADRs

- **(없음)** — 이번 수정으로 독립 완결.

### 다른 페이지 적용 시
`/admin/inquiries`, `/admin/withdrawals` 도 같은 구조 (서버 컴포넌트 → 클라이언트 리스트) 로 만들 경우 **같은 버그 발생 가능**.
→ 해당 페이지 구현 시 **key prop 패턴 선제 적용** 권장.

---

## 9. Lessons Learned

### 기술적 교훈
1. **`useState(props.x)` 는 초기값 전용**. 동기화 필요하면 `useEffect` 또는 `key` 리마운트.
2. **Next.js App Router 의 컴포넌트 재사용**은 성능 최적화지만, 예상치 못한 state 유지 문제 유발.
3. **URL, Network, UI 는 3개의 다른 진실** — 하나씩 확인해야 원인 특정 가능.

### 디버깅 교훈
```
증상: UI 만 반영 안 됨
확인 순서:
1. URL → 반영됨 (서버 라우팅 OK)
2. Network → 요청 나감, 응답 정상 (서버 쿼리 OK)
3. 서버 응답 직접 실행 → 정상 (데이터 OK)
4. 결론: 클라이언트 렌더링 단계 버그
```

→ **"증상이 마지막 레이어에만 있으면 그 레이어 문제"**. 체계적 배제법.

### 협업 교훈
- Claude Code 가 **props 초기화 패턴** 까지 정확히 짚음 (특히 `useState(props.x)` 는 초기값 전용이라는 사실)
- 2가지 수정 옵션을 trade-off 와 함께 제시 → 웹 Claude 가 EV 분석 → 1안 채택
- **"원인 진단 → 해결책 2안 → 선택 근거"** 패턴이 정석

### 포트폴리오 가치
면접 질문 "최근 해결한 까다로운 버그" 답변 소재:
> "Next.js App Router 의 서버 ↔ 클라이언트 컴포넌트 경계에서 `useState(props)` 초기화 함정을 디버깅했어요. URL/Network 는 정상인데 UI만 업데이트 안 되는 증상으로, **같은 라우트 내 컴포넌트 재사용** 이 원인이었어요. `key` prop 리마운트와 `useEffect` 동기화 두 방식을 비교해서, 어드민 특성상 스크롤 유지 필요 없다는 점을 근거로 `key` 방식을 채택했어요. 1줄 수정으로 해결."

---

## Appendix A: React 의 useState 와 props

```typescript
// ❌ 흔한 실수
const [count, setCount] = useState(props.initialCount);
// → props.initialCount 가 바뀌어도 state 는 유지

// ✅ 해결책 1: useEffect 동기화
useEffect(() => {
  setCount(props.initialCount);
}, [props.initialCount]);

// ✅ 해결책 2: key 리마운트 (부모에서)
<Child key={props.initialCount} initialCount={props.initialCount} />

// ✅ 해결책 3: 상태 자체를 props 로 (controlled)
<Child count={count} onCountChange={setCount} />
```

세 가지 다 **용도별 장단점** 존재. 이번 케이스는 2번 (key) 채택.

---

## Appendix B: 이 버그가 자주 발생하는 이유

Next.js 13+ App Router 도입 후 개발자들이 자주 겪는 함정:

### Pages Router (이전)
```
페이지 전환 = 컴포넌트 완전 언마운트 → 재마운트
→ useState 재초기화됨 → 버그 없음
```

### App Router (현재)
```
같은 라우트 내 searchParams 변경 = 컴포넌트 재사용
→ useState 유지됨 → 동기화 이슈 발생
```

**Next.js 가 성능을 위해 하는 최적화가 개발자에게 숨은 함정이 됨**.
→ 프로젝트 전체에서 "서버 props → useState 초기화" 패턴이 있는 곳 다시 점검 필요.

---

## Appendix C: EV 프레임 적용 진화

| ADR | 영역 | 감 vs EV |
|-----|------|---------|
| 0001 NAT 모델 | 비즈니스 | 감 = EV |
| 0002 통합 저장 | 기술 | 감 = EV |
| 0003 어드민 위치 | 기술 | 감 ≠ EV |
| 0004 패들 시점 | 비즈니스+법무 | 감 = EV |
| **0005 key 리마운트** | **기술 버그 대응** | **감 = EV** |

5번째 ADR. **EV 프레임이 "버그 수정 옵션 비교" 까지 확장 적용**.
→ 아키텍처 결정뿐 아니라 **미시적 구현 결정에도 유효**함을 증명.

---

**End of ADR-0005 v1.**
