# Novel Agent — PRD (제품 요구사항 정리)

> **목적:** MVP 기준으로 이미 반영된 요구사항과, 아직 미구현·예정인 항목을 한 문서에서 추적합니다.  
> **구현 상세:** [IMPLEMENTATION.md](./IMPLEMENTATION.md), 루트 [README.md](../README.md)

---

## 1. 제품 개요

| 항목 | 내용 |
|------|------|
| **한 줄** | 웹소설 원고를 업로드하면 AI가 흥행 가능성·개선점을 분석해 주는 작가용 웹 서비스 |
| **1차 타겟** | 플랫폼 데뷔·연재 준비 중인 웹소설 작가, 1인 편집 환경에서 피드백이 필요한 작가 |
| **1차(MVP) 범위** | 로그인 후 **본인 작품만** 대시보드에서 관리: 업로드·회차 관리·AI 분석·리포트·NAT(크레딧) 소모·청구 안내 UI. **공개 탐색(`/explore`)은 비활성(미들웨어 리다이렉트)** — 개인용 분석 툴 컨셉 |
| **의도적 비범위(MVP)** | 블록체인·지갑·IPFS·실결제·출판사 매칭 등은 [README 로드맵](../README.md)에 두고 이후 단계로 분리 |

---

## 2. 사용자 여정 (핵심 플로우)

### 2.1 작가

1. **가입·로그인** (Supabase Auth, 이메일/비밀번호)
2. **작품·회차** 생성·편집, 원고 본문 입력
3. **AI 분석** 실행 (회차 단위 또는 일괄)
   - 원고 **글자 수**에 따라 분기 (아래 3절)
   - **NAT** 잔액 확인 모달 → 차감 후 분석 실행
4. **결과** `analysis_runs`에 저장, 화면에서 리포트 확인
5. **NAT 부족** 시 `/billing`으로 안내 (유료 충전은 연동 예정)

### 2.2 공개 탐색(후속 단계)

- **1차에서는 제공하지 않음.** UI·내비에서 제거, `/explore` 접근은 홈으로 리다이렉트.
- 향후 재개 시: 공개 작품·회차 열람, 로그인 시 읽기 로그(Agent Score 등) 등 검토.

---

## 3. 원고 분석 — 글자 수·품질 정책 (구현됨)

| 구간 | 동작 |
|------|------|
| **500자 미만** | 분석 버튼 비활성. 안내: *「분석하기에 원고량이 부족합니다. 최소 500자 이상 입력해주세요.」* API 호출 시 `400` + `MANUSCRIPT_TOO_SHORT` |
| **500자 이상 ~ 1,000자 미만** | 경고 모달: *「원고량이 적어 분석 정확도가 낮을 수 있습니다. 계속하시겠습니까?」* 확인 후 NAT 모달·분석 진행 |
| **1,000자 이상** | 경고 없이 NAT 확인 후 분석 |

**코드:** `onehandbook/src/lib/manuscriptEligibility.ts`, `AnalyzePanel`, `WorkAnalysisHub`, `POST /api/analyze`

---

## 4. AI 분석 — 모델·플랫폼 (구현됨)

| 요구사항 | 구현 |
|----------|------|
| **모델** | 분석은 **Claude 단일 모델** (`claude-sonnet-4-5`, `ANALYSIS_CLAUDE_MODEL`)로 통일 |
| **플랫폼 분기** | 문피아 / 카카오페이지 / 네이버 시리즈 / **범용(generic)** 은 **시스템·플랫폼 프롬프트 파일만** 다르게 로드 (`prompts/analysis/`) |
| **플랫폼 옵션 OFF** | 범용 프로필(`generic`) — 동일 Claude, 일반 점검용 프롬프트 |
| **채점 톤** | 베이스 시스템 프롬프트에 **실제 편집자 기준 냉정 평가**, **90점 이상은 즉시 연재 가능한 수준에만** 부여하라는 보수적 지침 포함 (`prompts/analysis/base-system.md`) |

**코드:** `src/config/analysis-profiles.ts`, `src/lib/ai/runAnalysis.ts`, `prompts/analysis/`

---

## 5. NAT (Novel Agent Token) (구현됨)

- **규칙:** 원고 글자 수 구간별 기본 NAT, 옵션(세계관·인물 / 플랫폼 최적화) 가산 — 루트 README 표와 `src/lib/nat.ts` 기준
- **차감:** Supabase RPC `consume_nat`, 분석 성공 저장 후 차감; 실패 시 롤백
- **API:** 잔액 부족 `402` `INSUFFICIENT_NAT`

**미구현:** 실제 결제·패키지·웹훅 (`/billing` placeholder)

---

## 6. 데이터·보안 (구현·주의)

- **테이블:** `users`(nat_balance), `works`, `episodes`, `analysis_runs`, `reader_actions` 등 — `IMPLEMENTATION.md` 참고
- **RLS** 적용; 운영 시 `nat_balance` 직접 조작 가능 여부 등은 별도 하드닝 검토 권장
- **API 키** 서버 전용, 클라이언트 비노출

---

## 7. 백로그·일정

상세 우선순위·스프린트·마일스톤은 **[BACKLOG.md](./BACKLOG.md)** 에 정리합니다. (머리만 쓰지 말고 그쪽에만 적어 두면 됩니다.)

---

## 8. 문서 역할

| 파일 | 역할 |
|------|------|
| [README.md](../README.md) | 제품 소개, NAT 표, 스택, 로드맵, 개발 시작 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | 코드·라우트·마이그레이션·환경변수 |
| **PRD.md (본 문서)** | 요구사항·정책·구현 여부 한눈에 보기 |
| **[BACKLOG.md](./BACKLOG.md)** | 백로그·우선순위·일정(주간/마일스톤) |

*본 PRD는 저장소 상태를 기준으로 수시 갱신합니다.*
