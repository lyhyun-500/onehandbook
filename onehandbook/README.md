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

분석 엔진은 **Claude** 단일 모델이며, 문피아·카카오페이지·네이버 시리즈·범용은 **프롬프트만** 다릅니다. 환경 변수는 **`ANTHROPIC_API_KEY`** 가 필요합니다. **네이버 로그인**은 서버 전용 **`NAVER_CLIENT_ID`**, **`NAVER_CLIENT_SECRET`** (로컬 `.env.local` + **Vercel** 동시 설정). 끄려면 `NAVER_LOGIN_ENABLED=false` 또는 `NEXT_PUBLIC_NAVER_LOGIN_ENABLED=false` — 예시는 `.env.local.example` 참고.  
제품·요구사항·백로그는 상위 **`docs/PRD.md`**, **`docs/BACKLOG.md`** 를 참고하세요.

## Chroma RAG (웹소설 트렌드)

`data/trends/` 에 `.txt` / `.md` 를 두고, 로컬 Chroma 서버를 띄운 뒤 인제스트합니다.

1. `npm run chroma:run` (별 터미널, 영속: `data/chroma_db/`)
2. `npm run trends:ingest`
3. 앱 실행 후 `POST /api/rag/trends/search` — 본문 `{ "query": "…", "n": 8, "genre": "로맨스" }` (로그인 또는 `TRENDS_RAG_API_SECRET`). `.md` 프론트매터로 `genre`·`date` 를 넣어 인제스트하면 메타 필터·최신순 정렬이 동작합니다. 분석 에이전트에는 **트렌드 요약 블록**만 system 프롬프트로 주입됩니다.

자세한 절차는 **`data/trends/README.md`** 참고. 프로덕션 빌드는 `@chroma-core/default-embed` 와 Turbopack 충돌을 피하기 위해 **`npm run build` 가 `next build --webpack`** 을 사용합니다.
