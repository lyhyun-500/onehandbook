# ADR-0003: 어드민 페이지 위치 — `/admin` 경로 (단일 도메인)

**Status**: Accepted
**Date**: 2026-04-21
**Author**: LEE
**Reviewer**: 웹 Claude (EV 분석 보조)
**Context**: Novel Agent / 어드민 MVP 구축 시점
**Related**: ADR-0001, ADR-0002

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-21 | 초안 — 서브도메인 검토 후 /admin 경로 결정 |

---

## 1. Context (배경)

### 문제
어드민 페이지 (유저 관리 / NAT 충전 / 문의 답장 / 탈퇴 로그) 를 구축할 때,
**어느 위치에 배치할 것인지** 결정 필요.

### 선택지
- 옵션 A: `/admin` 경로 (novelagent.kr/admin)
- 옵션 B: 서브도메인 (admin.novelagent.kr)
- 옵션 C: 별도 배포 (독립 Vercel 프로젝트)

### 제약
- 1인 운영, 복잡도 감당 범위
- Claude Code 로 자율 구축 예정 → 표준 Next.js 패턴이 유리
- 베타 단계, 어드민 사용자 = LEE 본인 1명
- 개발 환경 (`localhost`) 에서 쉽게 테스트 가능해야 함

---

## 2. Decision (결정)

**옵션 A — `/admin` 경로 채택.**

### 구체 설계
- 경로: `novelagent.kr/admin`
- Next.js App Router 의 `(admin)` 라우트 그룹 또는 `/app/admin/` 디렉토리
- 권한: `users.role = 'admin'` 필드 추가 + Middleware 에서 차단
- 인증 쿠키: 기존 소비자 사이트와 공유 (같은 도메인)
- 개발: `localhost:3000/admin`

### 재검토 시점 명시
**현재는 `/admin` 이 최적이나, 아래 조건 충족 시 서브도메인 이전 검토**:
- CS 담당자 영입 (어드민 전용 인증/권한 필요)
- B2B 버전 출시 (클라이언트사 관리자용)
- 어드민만 별도 배포 주기 (빈번 업데이트)

---

## 3. Alternatives Considered

### 옵션 B: 서브도메인 (admin.novelagent.kr)

**장점**:
- 완전 분리 느낌
- URL 구조 깔끔
- 포트폴리오 "멀티 도메인" 자산

**단점**:
- Next.js 미들웨어에서 서브도메인 분기 로직 필요 (복잡)
- Vercel 대시보드에 도메인 추가 + DNS CNAME + SSL 대기
- 인증 쿠키 도메인 범위 (`.novelagent.kr`) 로 확장 필요
- Supabase Auth redirect URL 별도 등록
- 개발 환경 localhost 에서 서브도메인 테스트 번거로움

### 옵션 C: 별도 배포

**장점**:
- 완전한 독립성
- 장애 격리

**단점**:
- Supabase 클라이언트 중복 설정
- 공통 코드 (유저 모델 등) 공유 어려움
- 배포/환경변수 이중 관리
- 비용 이중화 (Vercel 프로젝트 2개)

---

## 4. EV Analysis

> 공식: **E = P(win) × Gain − P(loss) × Loss**

### 옵션 A — `/admin` 경로 ⭐ 채택
P(win)  = 0.95
근거:   Next.js 기본 라우팅, 설정 리스크 없음
Gain:

빠른 구현 (미들웨어 + 라우트만)
개발 환경 localhost 그대로 테스트
인증 쿠키 공유 이슈 없음
Claude Code 가 표준 패턴으로 작업 가능

Loss:

URL 이 소비자 URL 과 섞임 (실제 문제 아님, 공개 안 함)
감추기 효과 약간 부족 (← 보안은 Middleware 로 해결)

EV ≈ 강한 양수

### 옵션 B — 서브도메인
P(win)  = 0.7
근거:   설정 구멍 가능성 (DNS/SSL/쿠키/redirect)
Gain:

분리감
포트폴리오 소재

Loss:

초기 설정 반나절~1일
인증 쿠키 디버깅 시간
환경 분기 (localhost vs admin.localhost)

EV ≈ 약한 양수

### 옵션 C — 별도 배포
P(win)  = 0.6
근거:   중복 설정 많음, 1인 운영에 부담
Gain:

완전 격리

Loss:

프로젝트 이중화
공통 코드 공유 어려움
환경변수/배포 이중 관리
Vercel 비용 증가 가능

EV ≈ 0 ~ 음수

### 비교

| 옵션 | EV | P(win) | 1인 운영 적합도 |
|-----|----|--------|-----------|
| **A /admin** | **강한 양수** | **0.95** | **최고** |
| B 서브도메인 | 약한 양수 | 0.7 | 중간 |
| C 별도 배포 | 0 ~ 음수 | 0.6 | 낮음 |

---

## 5. Consequences

### Positive
- 구현 난이도 최저 → Claude Code 자율 작업 적합
- 인증/쿠키 이슈 없음
- 로컬 개발 편의성
- 향후 서브도메인으로 이전 가능 (리다이렉트 한 줄)

### Negative
- URL 이 공개 도메인과 섞임
  - **완화책**: 어드민 URL 은 공개하지 않음, Middleware 로 비인가 접근 차단
- "소비자 사이트와 한 덩어리" 느낌
  - **완화책**: `(admin)` 라우트 그룹 + 별도 레이아웃으로 시각 분리

### Neutral
- 서브도메인 이전 시나리오는 미래 대응 가능 (지금 결정이 영구적 아님)

---

## 6. Implementation Notes

Claude Code 가 구현 시 참고:

### 라우트 구조
onehandbook/src/app/
├── (main)/           # 소비자 사이트
├── studio/           # 스튜디오
└── admin/            # 어드민 ← 신규
├── layout.tsx    # 어드민 전용 레이아웃
├── page.tsx      # /admin 대시보드
├── users/
├── inquiries/
└── withdrawals/

### 권한 차단 (Middleware)
```typescript
// onehandbook/src/middleware.ts 에 어드민 섹션 추가

if (pathname.startsWith('/admin')) {
  const user = await getUserFromSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}
```

### 권한 필드 추가
- `users.role` 컬럼 신설 (기본값 'user', 관리자는 'admin')
- 마이그레이션 SQL:
```sql
  ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
```
- LEE 본인 계정은 수동으로 'admin' 설정 (첫 어드민)

---

## 7. Open Questions

- 어드민 2FA 필요 여부 (베타는 생략, 매출 발생 후 검토)
- 어드민 접근 IP 제한 필요 여부 (현재 불필요)
- 어드민 UI 언어 (한국어 고정 vs i18n 준비)

---

## 8. Revisit Criteria

- CS 담당자 영입 (계정 분리 + 서브도메인 이전)
- B2B 버전 출시
- 어드민 사용자 5명 초과
- 소비자 사이트와 어드민 배포 주기 불일치 (주 2회 vs 월 1회 등)

---

## Appendix: "서브도메인 충동" 을 이긴 과정

v0 초안 단계에서 LEE 는 서브도메인 선호. 이유:
- "어드민 = 별도 공간" 의 직관
- 포트폴리오 차별화 의도

EV 분석 후 `/admin` 경로로 전환. 배운 것:

> **P(win) 0.95 vs 0.7 의 차이는 "감" 으로 잡히지 않는다.**
> EV 표로 숫자화하지 않았으면 서브도메인으로 갔을 것.

감과 EV 가 일치할 때는 감을 신뢰, **다를 때는 EV 를 우선**. 이번이 후자.

---

**End of ADR-0003.**

