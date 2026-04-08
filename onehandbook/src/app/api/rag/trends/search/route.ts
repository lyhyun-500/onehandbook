import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TrendsSearchExecutionResult } from "@/lib/chroma/trendsTypes";

export const runtime = "nodejs";

type Body = {
  query?: string;
  n?: number;
  /** 메타데이터 `genre` 와 일치하는 청크만 검색(없으면 전체 코퍼스). `전체`·미지정은 필터 생략과 동일 취급. */
  genre?: string;
};

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.TRENDS_RAG_API_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

/**
 * POST /api/rag/trends/search
 * Body: { "query": "질문", "n": 5, "genre": "로맨스" } (genre 선택)
 * — 로그인 세션 또는 `TRENDS_RAG_API_SECRET` + `Authorization: Bearer …`
 * — 로컬 Chroma 서버(`npm run chroma:run`) 및 인제스트(`npm run trends:ingest`) 선행
 */
export async function POST(request: Request) {
  // 프로덕션에서는 로컬 Chroma(+default-embed/transformers)가 서버리스 번들 한도를 초과할 수 있어 비활성화합니다.
  // (필요하면 별도 서비스로 분리하거나, 원격 임베딩/DB로 대체하세요.)
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "현재 배포 환경에서는 트렌드 RAG 검색을 사용할 수 없습니다." },
      { status: 404 }
    );
  }

  if (!(await authorize(request))) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query 필수" }, { status: 400 });
  }

  const { executeTrendsSearch, TRENDS_SEARCH_MAX_N } = await import(
    "@/lib/chroma/trendsSearchCore"
  );

  const n = Math.min(
    TRENDS_SEARCH_MAX_N,
    Math.max(1, typeof body.n === "number" && Number.isFinite(body.n) ? body.n : 8)
  );

  const genreRaw = typeof body.genre === "string" ? body.genre.trim() : "";

  try {
    const exec = await executeTrendsSearch(query, n, {
      genre: genreRaw || undefined,
    });
    const typed = exec as TrendsSearchExecutionResult;
    return NextResponse.json({
      query,
      n,
      genre: genreRaw || null,
      hits: typed.hits,
      usedGenreFilter: typed.usedGenreFilter,
      unfilteredFallback: typed.unfilteredFallback,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Chroma 검색에 실패했습니다. 서버 실행·인제스트 여부를 확인하세요.",
        detail: message,
      },
      { status: 503 }
    );
  }
}
