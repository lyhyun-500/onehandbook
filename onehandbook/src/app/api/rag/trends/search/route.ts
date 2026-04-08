import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  query?: string;
  n?: number;
  /** 메타데이터 `genre` 와 일치하는 청크만 검색(없으면 전체 코퍼스). `전체`·미지정은 필터 생략과 동일 취급. */
  genre?: string;
  /** 작품 태그(서브장르/키워드) — upstream에서 필터/가중치에 활용 */
  tags?: string[];
};

function upstreamBaseUrl(): string | null {
  const explicit = process.env.TRENDS_RAG_SEARCH_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return null;
}

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
 * — upstream(`TRENDS_RAG_SEARCH_BASE_URL`)로 프록시
 */
export async function POST(request: Request) {
  const base = upstreamBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: "트렌드 RAG upstream이 설정되지 않았습니다." },
      { status: 503 }
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

  try {
    const upstreamRes = await fetch(`${base}/api/rag/trends/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { authorization: request.headers.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await upstreamRes.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstreamRes.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "트렌드 RAG upstream 호출에 실패했습니다.",
        detail: message,
      },
      { status: 503 }
    );
  }
}
