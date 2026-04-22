# 03. Tech Spec — 기술 명세

---

## 1. 라우트 구조
onehandbook/src/app/
├── (main)/           # 소비자 사이트 (건드리지 않음)
├── studio/           # 스튜디오 (건드리지 않음)
├── api/              # API 라우트
│   ├── analyze/      # 건드리지 않음
│   └── admin/        # ← 어드민용 신규
│       ├── users/
│       ├── nat-adjust/
│       ├── inquiries/
│       └── stats/
└── admin/            # ← 신규
├── layout.tsx    # 어드민 전용 레이아웃
├── page.tsx      # /admin 대시보드
├── users/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── inquiries/
│   └── page.tsx
└── withdrawals/
└── page.tsx

### 네이밍 규칙
- 페이지 컴포넌트: `page.tsx`
- 레이아웃: `layout.tsx`
- 서버 컴포넌트 기본, 인터랙션 필요한 부분만 `'use client'`
- 어드민 공용 컴포넌트: `onehandbook/src/components/admin/`

---

## 2. DB 스키마 변경

### 2.1 users 테이블에 role 컬럼 추가
```sql
-- migrations/2026042X_add_admin_role.sql

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- 기존 유저는 모두 'user', 관리자는 별도 UPDATE 필요
-- LEE 본인 계정만 수동 처리:
-- UPDATE users SET role = 'admin' WHERE email = 'agent@novelagent.kr';
-- (위 UPDATE 는 LEE 가 수동 실행)

CREATE INDEX idx_users_role ON users(role) WHERE role != 'user';
```

**주의**:
- 마이그레이션 파일만 작성, **실행은 LEE 가 Supabase 대시보드에서 수동**
- LEE 본인 role = 'admin' 설정하는 UPDATE 는 **SQL 주석으로 안내만**

### 2.2 NAT 조정 로그 테이블 (신규)
```sql
-- migrations/2026042X_create_nat_adjustments.sql

CREATE TABLE nat_adjustments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('charge', 'deduct')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nat_adjustments_user ON nat_adjustments(user_id, created_at DESC);
CREATE INDEX idx_nat_adjustments_created ON nat_adjustments(created_at DESC);

-- RLS: 어드만 조회/작성
ALTER TABLE nat_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view nat_adjustments"
  ON nat_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert nat_adjustments"
  ON nat_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT ON nat_adjustments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE nat_adjustments_id_seq TO authenticated;
```

**설계 근거**:
- `adjustment_type` CHECK 로 오타 방지
- `amount` CHECK 로 음수 방지 (차감도 양수로 저장, 타입으로 구분)
- `balance_after` 저장으로 사후 감사 용이
- `adjusted_by` 로 "누가 조정했는지" 추적

### 2.3 inquiries 테이블 (기존 확인 후 결정)

**먼저 확인**: 이미 `inquiries` 테이블 존재 여부.

- 이미 있으면: `replied_at` 컬럼이 있는지 확인, 없으면 추가
```sql
  ALTER TABLE inquiries ADD COLUMN replied_at TIMESTAMPTZ;
  -- replied_at IS NULL = 미답장, NOT NULL = 답장 완료
```

- 없으면: 신규 생성
```sql
  CREATE TABLE inquiries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(auth_id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    replied_at TIMESTAMPTZ,
    replied_by UUID REFERENCES users(auth_id)
  );
  -- (RLS 및 GRANT 추가)
```

**⚠️ 작업 순서**:
1. 먼저 `supabase/migrations/` 스캔해서 inquiries 관련 파일 존재 여부 확인
2. Supabase 콘솔 접근 불가 시 LEE 에게 현황 질문
3. 그 후 마이그레이션 작성

---

## 3. 권한 / 인증

### 3.1 Middleware 차단

```typescript
// onehandbook/src/middleware.ts

import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/ssr';  // 이미 사용 중인지 확인

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 어드민 경로 차단
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient({ request, response });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // role 확인
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', session.user.id)
      .single();

    if (!user || user.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));  // 또는 404
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

**⚠️ 주의**:
- 기존 middleware.ts 가 있으면 **기존 로직에 병합** (덮어쓰기 금지)
- `createMiddlewareClient` 사용법은 실제 프로젝트 의존성 버전에 맞게 조정

### 3.2 API 라우트 권한 체크

모든 `/api/admin/**` 엔드포인트는 서버 측에서도 한 번 더 권한 확인:

```typescript
// 공용 헬퍼: onehandbook/src/lib/admin/requireAdmin.ts
export async function requireAdmin() {
  const supabase = createServerClient();  // 기존 사용 패턴 따르기
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', session.user.id)
    .single();

  if (!user || user.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return { session, user };
}
```

---

## 4. API 엔드포인트 설계

### 4.1 유저 목록 조회

GET /api/admin/users
Query:
?search=keyword          (이메일/닉네임 부분 일치)
&provider=google|naver   (선택)
&status=active|withdrawn (선택)
&sort=created_desc|nat_desc
&page=1
&limit=50
Response:
{ users: [...], total: 123, page: 1 }

### 4.2 유저 상세
GET /api/admin/users/[id]
Response:
{
user: {...},
works: [...],        // 최근 작품
recentAnalyses: [...], // 최근 분석 10건
inquiries: [...],     // 이 유저의 문의
natAdjustments: [...] // 최근 20건
}

### 4.3 NAT 조정 ⭐ 핵심
POST /api/admin/nat-adjust
Body:
{
userId: "uuid",
type: "charge" | "deduct",
amount: 50,
reason: "이벤트 보상"
}
Logic (트랜잭션적 처리):

requireAdmin()
users 에서 현재 잔량 조회
type=charge 이면 + amount, type=deduct 이면 - amount
차감 시 잔량 0 미만 불가 (에러)
users.nat_balance 업데이트
nat_adjustments INSERT (balance_after 기록)

Response:
{ success: true, newBalance: 95, adjustmentId: 123 }

**⚠️ 원자성**:
- Supabase PostgreSQL 함수 (RPC) 로 한 트랜잭션 처리 권장
- 또는 앱 레벨에서 try-catch 후 실패 시 복구 (MVP 충분)

### 4.4 문의 목록
GET /api/admin/inquiries
Query: ?status=unreplied|replied|all&period=7d|30d|all&search=...
Response: { inquiries: [...], total: N }
PATCH /api/admin/inquiries/[id]
Body: { replied: true | false }
Logic: replied_at = 현재 시각 or NULL

### 4.5 탈퇴 로그
GET /api/admin/withdrawals
Query: ?period=7d|30d|90d|all&page=1
Response: { withdrawals: [...], total: N }

### 4.6 대시보드 통계
GET /api/admin/stats
Response:
{
totalUsers: 1234,
newUsersToday: 12,
unrepliedInquiries: 5,
withdrawalsThisWeek: 3,
recentNatAdjustments: [...],  // 최근 5건
recentUnrepliedInquiries: [...]  // 최근 5건
}

---

## 5. 폴더 구조 (최종)
onehandbook/src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # /admin 대시보드
│   │   ├── users/
│   │   │   ├── page.tsx             # /admin/users
│   │   │   └── [id]/
│   │   │       └── page.tsx         # /admin/users/[id]
│   │   ├── inquiries/
│   │   │   └── page.tsx
│   │   └── withdrawals/
│   │       └── page.tsx
│   └── api/
│       └── admin/
│           ├── users/
│           │   ├── route.ts         # GET /api/admin/users
│           │   └── [id]/
│           │       └── route.ts     # GET /api/admin/users/[id]
│           ├── nat-adjust/
│           │   └── route.ts         # POST /api/admin/nat-adjust
│           ├── inquiries/
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── route.ts
│           ├── withdrawals/
│           │   └── route.ts
│           └── stats/
│               └── route.ts
├── components/
│   └── admin/                       # 어드민 전용 공용 컴포넌트
│       ├── AdminLayout.tsx
│       ├── AdminSidebar.tsx
│       ├── AdminHeader.tsx
│       ├── UserTable.tsx
│       ├── NatAdjustForm.tsx
│       ├── NatAdjustModal.tsx
│       ├── InquiryTable.tsx
│       └── StatCard.tsx
├── lib/
│   └── admin/
│       ├── requireAdmin.ts          # 권한 체크 헬퍼
│       ├── queries.ts               # 공용 쿼리
│       └── types.ts                 # 어드민 타입
└── middleware.ts                    # 기존 파일에 admin 차단 로직 추가

---

## 6. 환경 변수

### 기존 (이미 있음)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (서버용)

### 신규 (제안, LEE 에게 추가 요청할 것)
어드민 이메일 화이트리스트 (선택, role 컬럼으로 대체 가능)
ADMIN_EMAILS=agent@novelagent.kr,helper@novelagent.kr
이번 MVP 에서는 users.role 기반이라 별도 환경변수 불필요

**⚠️ Claude Code 가 `.env` 파일을 직접 수정하지 말 것.**
필요 시 "이 환경변수가 필요합니다" 보고만.

---

## 7. 타입 정의 (참고)

```typescript
// onehandbook/src/lib/admin/types.ts

export type AdminUser = {
  auth_id: string;
  email: string;
  nickname: string | null;
  login_provider: 'google' | 'naver';
  role: 'user' | 'admin';
  nat_balance: number;
  created_at: string;
  deleted_at: string | null;
  terms_agreed_at: string | null;
  privacy_agreed_at: string | null;
  marketing_agreed: boolean;
};

export type NatAdjustment = {
  id: number;
  user_id: string;
  adjustment_type: 'charge' | 'deduct';
  amount: number;
  reason: string;
  balance_after: number;
  adjusted_by: string;
  created_at: string;
};

export type Inquiry = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
};
```

---

## 8. 에러 처리 규칙

### 서버 측
- 권한 없음: `401 Unauthorized` 또는 `403 Forbidden`
- 존재하지 않는 리소스: `404 Not Found`
- 잘못된 입력: `400 Bad Request` + 메시지
- 서버 에러: `500` + 로그

### 클라이언트 측
- fetch 실패: 사용자에게 토스트 에러 + 재시도 버튼
- 빈 상태: "데이터가 없습니다" 메시지
- 로딩 중: 스켈레톤 또는 스피너

---

## 9. 성능 / 보안

### 성능
- 유저 목록: 50건씩 페이지네이션
- 쿼리: 집계는 DB 레벨 (N+1 피하기)
- 이미지/아바타: 있다면 lazy loading

### 보안
- 모든 `/api/admin/**` 엔드포인트는 **서버 측 권한 재확인** (클라이언트 추측 금지)
- SQL 인젝션: Supabase 클라이언트 파라미터 바인딩 그대로 사용
- XSS: React 기본 이스케이핑 신뢰, `dangerouslySetInnerHTML` 금지
- NAT 조정 시 로그 필수 (나중에 추적 가능하게)

---

## 10. 빌드 / 배포

### 로컬 빌드 검증
```bash
cd onehandbook
npm run build
```

### 배포
- `git push origin main` → Vercel 자동 배포 (LEE 가 수동 push)
- **Claude Code 는 push 하지 말 것** — 커밋까지만

---

**다음: `04-ui-guide.md` 읽기**
