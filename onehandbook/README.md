# Novel Agent — Next.js App

## 실행 방법

```bash
# 의존성 설치 (최초 1회)
npm install

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 확인

## Supabase 연결

1. `.env.local.example`을 `.env.local`로 복사
2. Supabase Dashboard > Project Settings > API에서 URL, anon key 복사
3. `.env.local`에 값 입력

```bash
cp .env.local.example .env.local
```

## 사용법

- **Client Component**: `import { createClient } from "@/lib/supabase/client"`
- **Server Component / API Route**: `import { createClient } from "@/lib/supabase/server"` (async 함수 내에서 호출)

## NAT (분석 크레딧)

AI 분석(`POST /api/analyze`)은 **NAT**를 소모합니다. 상위 폴더의 **`supabase-migration-nat.sql`** 을 Supabase SQL Editor에서 실행한 뒤 사용하세요 (`users.nat_balance`, `consume_nat` 함수 등). 소모 규칙은 `src/lib/nat.ts`와 루트 `README.md`를 참고합니다. 충전 UI는 `/billing`(결제 연동 전 placeholder).

분석 엔진은 **Claude** 단일 모델이며, 문피아·카카오페이지·네이버 시리즈·범용은 **프롬프트만** 다릅니다. 환경 변수는 **`ANTHROPIC_API_KEY`** 가 필요합니다. 제품·요구사항 요약은 상위 **`docs/PRD.md`** 를 참고하세요.
