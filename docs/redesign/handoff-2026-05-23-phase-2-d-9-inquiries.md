# Phase 2-D-9 — 1:1 문의함 페이지 재정비 핸드오프 (2026-05-23)

> 이 문서는 새 Claude 세션이 본 작업을 이어서 진행하기 위한 핸드오프 문서.
> 사실 영속화 + LEE 결정 영속화 + 본 채널 게이트 누적 영속화 + 다음 작업 진입 사양.

---

## §0. 진입 사실 우선순위

새 세션이 시작 시 다음 4 항목을 우선 read:
1. **본 문서 (handoff-2026-05-23)** — 전체 컨텍스트
2. **`CLAUDE.md` (OHB 루트)** — 프로젝트 정책 + Claude Code 가이드
3. **`design_novel/novel-agent/inquiries.jsx`** — 시안 정본 (511 lines)
4. **commit log** `git log --oneline -25` — 최근 25 commit history

---

## §1. 현재 작업 상태

### branch
- `feat/design-phase-2` (push 미수행, LEE Phase 2-D 일괄 push 정책)

### 본 작업 5 commit (Phase 2-D-9, 1:1 문의함 재정비)
```
5312029 fix(inquiries): switch composer to centered modal + remove inquiry id metadata
981e5e8 fix(inquiries): align header/main width + correct topbar height
3aa5658 refactor(inquiries): remove FAB + update entry copy
7b5359f feat(inquiries): rebuild inquiries page with 2-pane layout + 5 new components + close action API
b4ae51e chore(db): inquiries category remap + closed_at + RLS update policy
```

### 누적 push 대기 commit
- 본 작업 5 + 이전 누적 14 (온보딩 fixup 7~11) = **19 commit 누적**
- 이전 작업 (온보딩) 도 push 미수행 — Phase 2-D 일괄 push 정책 정합

### 현재 진입 단계
- **단계 4 LEE 시각 재검증 대기** (7 시나리오)
- dev server 가동 중 (`http://127.0.0.1:3000`, `WATCHPACK_POLLING=true NEXT_DISABLE_TURBOPACK=1 next dev --webpack`)

---

## §2. LEE 결정 영속화 (5 의제 + fixup 4건)

### 단계 1·2 결정 의제 6건
| 의제 | 채택 |
|---|---|
| FAB | 폐기 (사이트 전역 layout.tsx 마운트 제거 + FloatingInquiryButton.tsx 삭제) |
| 카테고리 enum | 옵션 A (시안 enum 채택: billing/analysis/bug/account/feature/etc) |
| usage 매핑 | usage → feature |
| status enum | 옵션 Z (closed_at column 추가, 3-state derive — `inProgress` 사용 X) |
| multi-turn | 옵션 Q (single-turn — content/reply_content 1:1 매핑) |
| 해결됨/추가 질문 | 옵션 R (시안 그대로 — answered 상태에서만 노출, closed 미표시) |
| unread derive | 옵션 1 (SKIP — list 행 unread dot 미표시) |
| 「추가 질문」 UX | 옵션 P (현 thread category prefill) |

### fixup 결정 4건
| 의제 | 채택 |
|---|---|
| layout 결함 정정 옵션 | 옵션 Y (main row max-w-6xl mx-auto + TopBar h-14 정합) |
| 결함 2 (overflow 갭) | **별도 라운드 분리** (본 작업 범위 외 — 다음 세션 진입 의제) |
| composer 모달 스타일 | 중앙 모달 (overlay + dim + ESC/X/배경 클릭) |
| #id 노출 (thread + list) | 양쪽 제거 (사용자 인지 부담 + 시각 노이즈 폐기) |
| 「추가 질문」 진입 시 thread panel | 유지 (모달 + panel 공존) |
| fixup 묶음 | 단일 fixup 통합 (옵션 B = `b020e54` reset --soft + 통합 commit) |

---

## §3. 운영 코드 ↔ DB 정합 사실

### DB (production Supabase `ystxvlibeqdrlnsriidh`)
- migration `20260522170000_inquiries_category_remap_and_close.sql` 적용 완료 (LEE Studio SQL Editor manual run, 2026-05-22)
- `inquiries.category` enum 6 값 + CHECK constraint
- `inquiries.closed_at` TIMESTAMPTZ column (NULL default)
- RLS policy `Users can close own inquiries` (owner 검증)
- column GRANT `UPDATE (closed_at) ON public.inquiries TO authenticated`

### 신규 7 파일
- `src/lib/inquiry/status.ts` — `deriveInquiryStatus` + `INQUIRY_STATUS_META` (3-state)
- `src/components/inquiries/atoms.tsx` — `InquiryCategoryChip` (hue HSL) + `InquiryStatusBadge` (3-state)
- `src/components/inquiries/InquiryListItem.tsx` — list 행 (active sky 좌측 border)
- `src/components/inquiries/InquiryThread.tsx` — detail (single-turn + 「해결됨」/「추가 질문」)
- `src/components/inquiries/InquiryComposer.tsx` — 중앙 모달 (ESC/X/배경 클릭/취소)
- `src/app/(app)/account/inquiries/InquiriesClient.tsx` — 2-pane orchestration
- `src/app/api/account/inquiries/[id]/close/route.ts` — POST close handler

### 수정 5 파일
- `src/lib/inquiry/categories.ts` — 시안 enum 정합 + hue 필드 + `inquiryCategoryHue` util
- `src/app/(app)/account/inquiries/page.tsx` — server 재구축 + `h-[calc(100vh-3.5rem)]` (TopBar h-14 정합)
- `src/lib/admin/inquiryQueries.ts:135` — fallback `"general" → "etc"`
- `src/app/api/admin/inquiries/[id]/route.ts:163` — fallback `"general" → "etc"`
- `src/app/layout.tsx` — FloatingInquiryButton import + 마운트 제거

### 삭제 1 파일
- `src/components/FloatingInquiryButton.tsx` (363 lines)

### 진입 동선 7건 (모두 `/account/inquiries` 정합 — 변경 0)
- UserMenuDropdown / HelpPopover / GuideClient / FAQSection / AnalysisFailed.onReport (호출자 0건) / account/page.tsx / admin reply notifications

---

## §4. LEE 시각 재검증 사양 (7 시나리오, 단계 4 진입 대기)

### 사전 조건
- branch: `feat/design-phase-2`
- dev server: `http://127.0.0.1:3000` (가동 중 또는 재기동)
- 최신 commit: `5312029`
- DB: production Supabase 적용 완료
- 테스트 데이터: LEE 가 inquiries 테이블에 mock row 직접 INSERT 또는 신규 작성 + admin 답변 추가

### 시나리오 (LEE 본인 직접 검증)
1. **「+ 문의하기」 → 중앙 모달 노출** — fixed inset-0 + dim (stone-950/80) + backdrop-blur-sm + 박스 (640px, max-h 90vh, rounded-xl, shadow-2xl)
2. **ESC / X / 배경 클릭 / 「취소」 close** — 4종 trigger 정합
3. **list row 클릭 → thread panel + 「+ 문의하기」 → 모달 + panel 공존** — selectedId 유지, composing true
4. **thread answered → 「추가 질문」 → 모달 + panel 공존 + category prefill** — askingFromCategory 전달, composer initialCategory 적용
5. **모달 close → thread panel 복원** — selectedId 보존, panel 재노출
6. **list rows 메타 = #id 부재** ✅ — lastActivity 우측 단독
7. **thread header 메타 = #id 부재** ✅ — 카테고리 chip + 접수 + 답변 시점만

### 검증 통과 후
- LEE 통과 신호 → 다음 세션이 push 진입 사양 보고 (Phase 2-D 일괄 push 정책)
- 시각 의문 발생 시 → 새 fixup 라운드 진입 사양

---

## §5. 누락 의제 (다음 세션 진입 대상)

### 의제 1: 결함 2 (overflow 갭) — 별도 라운드 분리 (LEE 결정 영속화)
- **사실**: `src/app/(app)/layout.tsx` children wrapper = `overflow-y-auto` (모든 page 통일)
- **시안 사실** (`design_novel/novel-agent/app.jsx:194`): `page === "inquiries" ? content : <div overflow-y-auto>{content}</div>` (inquiries 분기 = overflow-hidden 직접 처리)
- **갭**: 운영에서 inquiries page = wrapper scroll + 자체 layout 이중 overflow
- **영향**: TopBar h-14 ↔ main `h-[calc(100vh-3.5rem)]` 정합 후에도 wrapper scroll 잔재 가능
- **사전 게이트 트리거**: 사이트 전역 (app)/layout 영향 = LEE 결정 게이트 필요

### 의제 2: realtime — Phase 분리
- composer 제출 후 list 자동 갱신 X (재방문 시 server fetch 반영)
- 「추가 질문」 신규 inquiry 후 list 자동 반영 X
- Supabase Realtime 구독 추가 의제

### 의제 3: focus trap — Phase 분리
- 모달 안 Tab 순환 미적용 (접근성 향상)
- ARIA: `role=dialog + aria-modal + aria-labelledby` 적용됨, focus trap 미적용

### 의제 4: unread derive — 옵션 1 (SKIP) 영속화 (선택 의제)
- 현재 unread dot 미표시 (시안 SKIP 결정)
- 향후 notifications.read_at 또는 last_seen_at column 추가 검토 가능

### 의제 5: AnalysisFailed.onReport 호출자 활성화 (참고)
- 현재 onReport prop 호출자 0건 (단계 1 보고 영속화)
- 분석 실패 시 「문의함에 신고」 버튼 동작 활성화 가능 (별도 라운드)

---

## §6. 본 채널 누적 게이트 10건 (영속화)

| # | 게이트 |
|---|---|
| 1 | runtime 사실 검증 (코드 read ≠ runtime 동작) |
| 2 | 운영 main 브랜치 코드 검증 (`git show main:<path>`) |
| 3 | Supabase / external service 동작 (공식 문서 + 운영 사실) |
| 4 | 사용자 시각 보고 출처 검증 (운영? 로컬? feature? main?) |
| 5 | LEE 로컬 branch sync 검증 |
| 6 | 추측 단정 금지 (LEE 결정 게이트 통과 전 단정 X) |
| 7 | 시안 정합 시각 검증 (LEE D-B 검증 통과 전 단정 不可) |
| 8 | 권한 사실 사전 점검 (DB / API 적용 권한) |
| 9 | DB schema ↔ 코드 변경 commit 분할 시간 갭 점검 |
| 10 | 시안 mockup ↔ 실제 UX 사실 검증 (mockup 결함 가능성) |

### 게이트 작동 사례 (본 작업)
- 게이트 1 (DB migration 적용 사실 영속화) — commit 1
- 게이트 6 (Claude Code 자동 적용 권한 부재 → LEE 결정 게이트 분리) — commit 1 사전
- 게이트 10 첫 작동: layout boundary 결함 (981e5e8 fixup)
- 게이트 10 두 번째 작동: composer panel 좁아짐 + #id 시각 노이즈 (5312029 fixup)

---

## §7. 핸드오프 §6 문구 정합 14건 (적용 영속화)

| 위치 | 문구 |
|---|---|
| 페이지 헤더 kicker | `1:1 문의` |
| 페이지 헤더 H1 | `내 문의 내역` |
| 페이지 헤더 sub | `작성하신 문의와 답변을 확인하실 수 있습니다. 답변이 도착하면 알림 메시지가 도착합니다.` |
| stats grid | `진행 중 / 답변 대기 / 답변 완료` |
| filter tabs | `전체 / 진행 중 / 답변 완료 / 종료` |
| helper card | `자주 묻는 질문 / 결제·NAT, 분석 모델, 계정 관련 답변을 먼저 확인해보세요. / FAQ 보기 →` (→ /guide) |
| Composer 헤더 | `1:1 문의` / `Novel Agent` |
| Composer banner | `운영 시간 / 평일 10:00 ~ 18:00 · 점심시간·공휴일 제외 (순차 답변)` |
| Composer 답변 안내 | `답변은 사이트 알림으로 안내드리며, 내 문의 페이지에서 다시 확인할 수 있습니다.` |
| Composer 동의 | `[필수] 상담을 위해 문의 내용이 운영팀에 전달·저장되는 것에 동의합니다. (수집·이용 동의)` |
| Composer 액션 | `취소` / `문의하기` |
| Thread back link | `← 문의 목록으로` (상/하) |
| Thread sections | `내 질문` / `Novel Agent 답변` |
| Thread waiting placeholder | `답변 대기 중 / 운영팀이 확인하는 대로 답변드리겠습니다. 답변이 도착하면 알림 메시지가 도착합니다.` |
| Thread answered footer | `답변이 도움이 되었나요? / 👍 해결됨 / 추가 질문` |
| empty state | `위의 「문의하기」 버튼으로 첫 문의를 작성해 보세요.` |

**금지 용어** (잔재 0 확인): `헤더 알림` / `알림 종` / `HTML`

---

## §8. 다음 세션 진입 사양

### 진입 시점 분기 (LEE 응답에 따라)

#### 분기 A: LEE 시각 재검증 통과
- push 진입 사양 보고:
  - origin / branch / 강제 푸시 여부 LEE 결정 게이트
  - push 대상 = 19 commit 누적
- push 후 → 단계 종료 + 의제 5 진입 (별도 작업)

#### 분기 B: LEE 시각 의문 발생
- 의문 사실 영속화 형식 = 시안 위치 + 운영 위치 + 시각 차이 (이미지 또는 텍스트)
- 새 fixup 라운드 진입 (단계 4 재진입)
- 사양: 사실 보고 → LEE 결정 게이트 → 진행

#### 분기 C: 의제 1 (overflow 갭) 진입
- (app)/layout children wrapper 의 inquiries 분기 추가
- 사이트 전역 영향 평가 + LEE 결정 게이트
- 시안 app.jsx:194 분기 정합

### 새 세션 시작 사양
1. 본 문서 read (전체)
2. CLAUDE.md read (OHB 루트)
3. `git log --oneline -25` 확인
4. `git status` 확인 (working tree 정합)
5. LEE 응답 기반 분기 진입

### LEE 운영 패턴 (영속화)
- Phase 2-D 일괄 push 정책 (단계 작업 통과 후 일괄)
- LEE 결정 게이트 = 보고 + 옵션 + 추천 + 결정 신호 대기
- DB 변경 = LEE Studio SQL Editor manual run (사양 §3 path 정합)
- 시각 검증 = LEE 직접 (Claude Code 외부)
- 추측 단정 금지 = LEE 결정 게이트 통과 전 진행 X
- 시안 정합 = LEE 시각 검증 후 확정

### 본 채널 운영 패턴 (영속화)
- 단계 분리 (1 시안 분해 / 2 구현 계획 / 3 commit / 4 검증)
- commit body 사실 명시 (게이트 통과 + 결정 영속화 + rollback 메타)
- grep 안전망 7 카테고리 (FAB / 운영 enum / 금지 용어 / 신규 컴포넌트 / 시안 enum / #id 잔재 / z-index 충돌)
- 본 채널 게이트 10건 누적

---

## §9. 환경 + 도구 사실

### 환경
- Working directory: `/Users/yonghyun/Desktop/OHB/onehandbook/`
- Supabase migrations: `/Users/yonghyun/Desktop/OHB/supabase/migrations/`
- 시안: `/Users/yonghyun/Desktop/design_novel/novel-agent/`
- dev server: `WATCHPACK_POLLING=true NEXT_DISABLE_TURBOPACK=1 next dev --webpack`, port 3000
- Supabase project: `ystxvlibeqdrlnsriidh` (production)

### DB 적용 권한 (게이트 8 영속화)
- supabase CLI = 미설치
- psql = 설치됨 (PostgreSQL 18.3), 단 `DATABASE_URL` env 부재
- Supabase Management API = Personal Access Token 부재 (SERVICE_ROLE_KEY 만 존재)
- PostgREST = DDL 불가
- **유일 가능 path** = LEE Studio SQL Editor manual run (옵션 A)

### CLAUDE.md 금지 사항 (영속화)
- `.env` / `.env.local` 직접 수정 금지
- 기존 DB 테이블 구조 변경 금지 (신규 테이블 추가만) — 단 LEE 사양 명시 시 통과 (본 작업 inquiries 변경 = LEE 결정 통과 영속화)
- `supabase/migrations/*` 기존 파일 수정 금지 (신규 추가만)
- `onehandbook/src/app/api/analyze/**` = 분석 파이프라인 (운영 중, 신중)
- 푸시 자동 실행 금지

---

**End of handoff-2026-05-23-phase-2-d-9-inquiries.md**
