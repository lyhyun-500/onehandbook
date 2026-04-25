# ADR-0009: Phase 3 결제 활성화 로드맵 (메타)

**Status**: Accepted
**Date**: 2026-04-25
**Author**: LEE
**Reviewer**: 웹 Claude (메타 설계 보조)
**Context**: Novel Agent / Phase 2 사이드 패널 리디자인 완료 후 다음 큰 영역 = 결제 시스템 활성화
**Related**: ADR-0004 (패들 결제 오픈 시점), ADR-0007 (Phase 2 회고 — 메타 ADR 패턴 첫 사례)

---

## Revision History

| 버전 | 날짜 | 변경 |
|-----|------|-----|
| v1 | 2026-04-25 | 초안 — 3단계 (Phase 3a/3b/3c) 구조 + 단계 의존성 + 트리거 명시 |

---

## 1. Context (배경)

### 무엇이 끝났나
- Phase 2 사이드 패널 리디자인 스프린트 완료 (4/20 ~ 4/25)
- 어드민 MVP 4페이지 완성 (대시보드 / 유저 / 탈퇴 / 문의)
- 알림 시스템 통합 (notifications 테이블 도입, ADR-0008)
- 마이페이지 신설 (/account)

### 다음 큰 영역
**Phase 3: 결제 시스템 활성화** (Paddle).

### 왜 메타 ADR 인가
ADR-0007 (Phase 2 회고) 에서 검증된 패턴:
> "메타 ADR = 단일 결정 아닌 **시리즈 전체 로드맵** 기록"

Phase 3 는 단일 결정 아님:
- 3a: Paddle Sandbox 연동 (코드 작업)
- 3b: Staging 서버 구축 (인프라 작업)
- 3c: 결제 오픈 활성화 (비즈니스 트리거, ADR-0004 와 연계)

→ **각 단계는 자체 ADR 가질 가치**. 이 ADR 은 **상위 로드맵**.

### 핵심 질문 미리 답함
- "Staging 서버 필요한가?" → **필요 (Phase 3b)**
- "언제 만드나?" → **Phase 3a 완성 후, 결제 활성화 전**
- "Paddle Sandbox 만으로 되나?" → **개발 중 OK, 라이브 검증엔 부족**

---

## 2. Decision (결정)

### 2-1. 3단계 구조 채택

```
Phase 3a: Paddle Sandbox 연동
  - 코드 작업 (Webhook, NAT 충전 자동화, 어드민 결제 UI)
  - 환경변수 토글 (sandbox vs production)
  - 라이브 도메인에서 Sandbox 모드 동작
  
Phase 3b: Staging 서버 구축
  - Production 미러
  - 별도 Supabase 프로젝트
  - staging.novelagent.kr 도메인
  - 회귀 테스트 환경 확보
  
Phase 3c: 결제 오픈 활성화
  - ADR-0004 의 Go/No-Go 체크리스트 통과
  - 사업자 등록 + 세무사 상담 완료
  - Staging 검증 통과
  - 환경변수 production 전환
```

### 2-2. 단계 의존성

```
3a → 3b → 3c (역순 불가)
```

**왜 이 순서**:
- **3b 가 3a 보다 먼저 = 검증할 코드 없음**
- **3c 가 3b 보다 먼저 = 라이브 검증 없이 결제 활성화 = 위험**

### 2-3. 단계별 ADR 분리

- **ADR-0010 (예정)**: Phase 3a 진입 시점에 작성
  - Paddle 연동 상세 (Webhook, 결제 흐름, NAT 충전 자동화)
  - sandbox vs production 환경변수 분기
  
- **ADR-0011 (예정)**: Phase 3b 진입 시점에 작성
  - Staging 서버 구축 상세
  - DB 분리 전략 (Supabase 프로젝트 2개 vs 환경 변수만)
  - 마이그레이션 이중 적용 정책
  
- **ADR-0004 (기존)**: Phase 3c 의 Go/No-Go 체크리스트
  - v2 로 업데이트 가능

---

## 3. 단계별 상세 (개요)

### Phase 3a: Paddle Sandbox 연동

**목적**: 결제 코드 작성 + 검증 (실제 돈 안 쓰고).

**작업 추정**:
- Webhook 처리 코드 (성공/실패/환불 이벤트)
- NAT 충전 자동화 (수동 어드민 조정 → 결제 시 자동 INSERT)
- 어드민 결제 내역 페이지 신규
- 환경변수 토글 (sandbox/production)

**작업 시간**: 4~6일 (베타 운영 병행 시 1~2주)

**산출물**:
- ADR-0010 (Phase 3a 상세)
- 결제 코드 (sandbox 모드 동작)
- 어드민 결제 내역 UI

**Open Questions**:
- 기존 NAT 토큰 모델 (ADR-0001) 과 결제 흐름 매핑 방식
- 결제 실패 시 NAT 롤백 정책
- 환불 시 NAT 차감 정책 (사용 후 환불 케이스)

### Phase 3b: Staging 서버 구축

**목적**: 라이브 환경 시뮬레이션. 결제 코드 회귀 테스트.

**작업 추정**:
- 새 Vercel 프로젝트 (또는 Preview 활용)
- 새 Supabase 프로젝트 (DB 분리)
- staging.novelagent.kr 도메인 설정
- Paddle Sandbox 연동 (라이브와 동일)
- 마이그레이션 이중 적용 워크플로

**작업 시간**: 3~5일

**산출물**:
- ADR-0011 (Phase 3b 상세)
- staging.novelagent.kr (운영)
- 회귀 테스트 가이드

**비용 영향**:
- Supabase Pro 추가 (필요 시) — 또는 Free tier 분리
- Vercel 무료 (Hobby)
- 도메인은 기존 사용

**Open Questions**:
- Supabase 프로젝트 2개 vs 같은 프로젝트 + 환경변수
- 마이그레이션 적용 순서 (staging → production?)
- 데이터 sync 정책 (production → staging 복제 빈도)

### Phase 3c: 결제 오픈 활성화

**목적**: 실제 결제 받기 시작.

**작업 추정** (대부분 ADR-0004 의 Go/No-Go):
- 사업자 등록증 수령
- 사업자 계좌 + Paddle Payout 연결
- 세무사 상담 완료
- 약관 업데이트 (환불, 결제)
- Staging 검증 통과
- 환경변수 production 전환

**시점**: ADR-0004 의 시점 (사업자 + 세무사 완료 후, 약 9월~10월)

**산출물**:
- ADR-0004 v2 (실제 오픈 회고 추가)
- Production 결제 활성화

---

## 4. EV Analysis

### 메타 ADR 채택 vs 풀 ADR 1개

#### 옵션 Z (메타 + 하위) ⭐ 채택
```
P(win) = 0.9

Gain:
- 오늘 부담 적음 (메타만 50~100줄)
- 각 단계 진입 시점에 현실 반영된 ADR 작성
- ADR-0007 회고 패턴 재활용 (메타 ADR 검증됨)
- 하위 ADR 작성 트리거 명확

Loss:
- ADR 번호 4개 (0009 + 0010 + 0011 + ADR-0004 v2)
- 약간의 중복

EV ≈ 강한 양수
```

#### 옵션 X (풀 ADR 1개)
```
P(win) = 0.7

Gain: 한 번에 끝, 통합 관점
Loss: 1.5시간+ (피로 누적), 미래 변경 시 큰 ADR 수정 부담
EV ≈ 양수 (Z 보다 낮음)
```

#### 옵션 Y (Phase 3a ADR 만)
```
P(win) = 0.7

Gain: 즉시 시작
Loss: 3b/3c 미래 결정 누락, 단계 의존성 명시 X
EV ≈ 양수 (메타 누락 손실)
```

→ **Z 명백히 우세**.

---

## 5. Consequences

### Positive
- 단계 의존성 명확 (3a → 3b → 3c)
- 각 단계 진입 시점에 적절한 ADR 작성 (현실 반영)
- ADR-0004 와 자연스러운 연결 (Phase 3c 가 ADR-0004 의 Go/No-Go 트리거)
- 메타 ADR 패턴 두 번째 적용 (ADR-0007 이어서) → **시리즈 진화 자산화**

### Negative
- ADR 번호 4개 사용 (0009 + 0010 + 0011 + ADR-0004 v2)
  → 근데 각 ADR 의미 명확하면 OK
- 미래 작성 부담 (3a/3b 진입 시 ADR 작성 필수)

### Neutral
- 단계별 시점 추정 (Phase 3a: 5~6월) 은 확정 아님
  - LEE 시간 확보 + 베타 운영 우선순위 따라 변동 가능

---

## 6. Open Questions (메타 수준)

### Q1: Phase 3a 시작 시점
- 빠르면: 5월 (Phase 2 종료 직후)
- 늦으면: 7월 (베타 유저 100명 도달 시)

LEE 의 시간 + 취업 활동 + 베타 안정화 우선순위 따라 결정.

### Q2: Staging 서버 = 별도 Supabase vs 환경변수
**별도 Supabase**:
- 데이터 완전 분리
- 비용 ↑
- 마이그레이션 이중 적용

**같은 Supabase + schema 분리**:
- 비용 ↓
- schema 관리 복잡

→ ADR-0011 에서 결정. 메타 단계에선 보류.

### Q3: 베타 결제 vs 정식 출시 결제
- 베타 기간 결제 받을지 (베타 유저 한정)
- 또는 정식 출시 후 결제

→ ADR-0004 에서 결정 (사업자 + 세무 완료 후 결제).
ADR-0007 의 베타 → 정식 전환 트리거 검토 필요.

---

## 7. Revisit Criteria

이 메타 ADR 자체 재검토 조건:

### 단계 분리 재고
- 3a + 3b 동시 진행이 더 효율적 발견 시
- 또는 3b 가 사실 불필요 (Paddle Sandbox 만으로 충분) 결론 시

### 시점 변경
- 사업자 등록 지연 (9월 → 12월)
- 세무사 상담 결과 "베타 6개월 더 권장"
- 경쟁사 진입으로 결제 우선순위 ↑

### 단계 추가
- 4단계 필요 (예: Phase 3d — 환불 자동화 시스템)
- → 별도 메타 ADR 또는 0009 v2

---

## 8. Implementation Notes

### 메타 ADR 의 역할
**규범 (specification) 아닌 가이드 (guide)**:
- 하위 ADR 이 메타 ADR 어겨도 됨 (단, 어긴 이유 명시)
- 메타 ADR 은 "큰 그림" 보존 + 시점 트리거 역할

### 하위 ADR 작성 시점
**ADR-0010 (Phase 3a)**:
- 트리거: LEE 가 "Phase 3a 시작" 결정한 시점
- 작성 시점: 코드 작업 시작 직전
- 분량: 풀 ADR (300~500줄)

**ADR-0011 (Phase 3b)**:
- 트리거: ADR-0010 의 코드 작업 완료 시점
- 작성 시점: Staging 인프라 구축 직전
- 분량: 풀 ADR (300~500줄)

**ADR-0004 v2**:
- 트리거: Phase 3c 진입 시점 (사업자 + 세무사 완료)
- 작성 시점: 결제 활성화 직전
- 분량: 기존 ADR-0004 의 Lessons Learned + v2 회고

---

## 9. Connection to Other ADRs

### ADR-0001 (NAT 토큰 모델)
- Phase 3a 의 NAT 충전 자동화 = ADR-0001 의 충전 흐름 구체화
- ADR-0010 작성 시 ADR-0001 참조 필수

### ADR-0004 (패들 결제 오픈 시점)
- Phase 3c 의 Go/No-Go = ADR-0004 의 체크리스트
- ADR-0004 가 비즈니스 트리거, 이 ADR (0009) 가 기술 로드맵

### ADR-0006 (알림 시스템 통합)
- 결제 알림 (성공/실패/환불) → notifications 테이블 활용
- ADR-0010 작성 시 알림 타입 enum 확장 필요 (`'payment_success'` 등)

### ADR-0007 (Phase 2 회고)
- 메타 ADR 패턴 첫 사례 (회고)
- 이 ADR (0009) = **메타 ADR 패턴 두 번째 사례 (로드맵)**
- 두 가지 메타 ADR 용도 검증됨

### ADR-0008 (notifications 테이블)
- 결제 알림 추가 시 옵션 B 옵션 (전체 마이그레이션) 트리거 가능
- 또는 이 ADR (0009) 진행 중 별도 ADR

---

## 10. ADR 시리즈 진화 (9번째)

| ADR | 영역 | 옵션 | 채택 | 트리거 | 메타? |
|-----|------|-----|-----|-------|------|
| 0001 | 비즈니스 | 3 | A | 초기 | X |
| 0002 v2 | 기술 | 2 | A | 피드백 | X |
| 0003 | 기술 | 3 | A | 어드민 도입 | X |
| 0004 | 비즈니스+법무 | 4 | C | 결제 준비 | X |
| 0005 | 기술 버그 | 3 | A | Phase 2-C 버그 | X |
| 0006 | 기술 버그 | 3 | A | 알림 동기화 | X |
| 0007 | **메타 (회고)** | N/A | N/A | Phase 2 마무리 | **O** |
| 0008 | 기술+비즈 | 3 | X | ADR-0006 트리거 | X |
| **0009** | **메타 (로드맵)** | **3** | **Z** | **Phase 2 종료** | **O** |

→ **9번째**. 메타 ADR 두 번째 사례.

**메타 ADR 패턴 검증**:
- ADR-0007: 과거 회고 (Phase 2 끝난 뒤)
- ADR-0009: 미래 로드맵 (Phase 3 시작 전)

→ **회고 + 로드맵** 양방향 메타 ADR 검증.

---

## Appendix A: Phase 3 의 "Staging" 정의

이 ADR 에서 "Staging 서버" 의 정확한 의미:

```
✅ Production 미러
   - 같은 코드베이스 (main 브랜치 또는 staging 브랜치)
   - 별도 도메인 (staging.novelagent.kr)
   - 별도 Supabase DB
   - Paddle Sandbox 환경

❌ "Production 보다 못한 서버"
   - 일부 기능만 동작 (X)
   - 실제 데이터 노출 (X)
   - 비공개 (X) — 베타 유저도 접근 가능

❌ "분기 Preview 서버"
   - Vercel Preview = PR 별 임시 서버 (다른 개념)
   - Staging = 영구 환경
```

**핵심**: Production 의 **모든 기능 + 분리된 환경**.

---

## Appendix B: 의도적 비범위

### 이 메타 ADR 에 포함 안 한 것

#### 1. 결제 흐름 상세 설계
- "유저 → 결제 페이지 → Paddle 리다이렉트 → Webhook → NAT 충전"
- 너무 구체. ADR-0010 영역.

#### 2. 어드민 결제 UI 디자인
- 결제 내역 페이지 컬럼, 환불 버튼 등
- ADR-0010 의 일부.

#### 3. 환불 정책 상세
- 미사용 NAT 환불 가능?
- 사용한 NAT 환불 가능?
- → ADR-0004 의 약관 업데이트 영역.

#### 4. 베타 가격 vs 정식 가격 차이
- ADR-0001 의 가격 정책 영역.

→ 이 메타 ADR = **로드맵 + 단계 의존성 + 트리거** 만.

---

## Appendix C: 메타 ADR 패턴의 가치

ADR-0007 + ADR-0009 = **메타 ADR 두 가지 용도** 정착:

### 용도 1: 회고 (ADR-0007)
- 끝난 작업 의 학습 추출
- 패턴 도출
- 다음 영역 transferable lesson

### 용도 2: 로드맵 (ADR-0009, 이 ADR)
- 시작 전 큰 그림
- 단계 의존성
- 하위 ADR 트리거 명시

### 공통 특징
- 단일 결정 아님
- 다른 ADR 들 연결
- "왜" 보다 "어떻게 펼칠까" 강조

→ ADR 패턴 진화 사례. 면접 답변 자산.

---

**End of ADR-0009 v1.**
