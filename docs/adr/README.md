# Architecture Decision Records (ADR)

Novel Agent 의 주요 아키텍처/제품 결정 기록.

## 이 폴더가 뭔가요?

ADR (Architecture Decision Record) = 중요한 기술/제품 결정의 배경, 대안, 결과를 짧게 기록한 문서.

## 작성 원칙

- **EV 분석 포함** — 기댓값 공식 (E = P(win)×Gain − P(loss)×Loss) 기반 의사결정
- **대안 명시** — 채택한 것 외에 검토한 옵션도 기록
- **재검토 조건 명시** — 언제 이 결정을 뒤집을지 미리 정의
- **버전 관리** — 피드백 받으면 v2, v3 로 업데이트 (삭제 X)
- **정직한 회고** — 검토 부족했던 부분도 솔직히 명시

## 인덱스

| ID | 제목 | Status | 버전 |
|----|------|--------|------|
| ADR-0001 | NAT 토큰 하이브리드 과금 모델 | Accepted | v1 |
| ADR-0002 | 통합 저장 — Promise.allSettled 채택 | Proposed | v2 |
| ADR-0003 | 어드민 위치 — /admin 경로 채택 | Accepted | v1 |
| ADR-0005 | Next.js useState props 초기화 함정 대응 | Accepted | v1 |
| ADR-0006 | 알림 읽음 상태 — analysis_jobs.read_at 채택 | Accepted | v1 |
| ADR-0007 | 사이드 패널 UI 리디자인 스프린트 (Phase 1~2-C) 회고 | Accepted | v1 |
| ADR-0008 | 알림 시스템 통합 + 사이트 내 1:1 문의 답변 | Accepted | v1 |

## 작성 예정 (Backlog)

- ADR-0004: 패들 결제 오픈 시점 판단
- ADR-0009: 자체 모델 파인튜닝 시작 조건

## 참고

- Michael Nygard 의 ADR 원형: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions

