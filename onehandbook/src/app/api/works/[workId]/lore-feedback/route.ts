// 추출 피드백 INSERT API — 의제 신규-1+2 단계 C-5 (commit 4) 정합.
//
// LEE 결정 영속화:
// - 결정 11 (옵션 F-4): inline + 닫기 가능 → server 사양 무관 (client UX)
// - 결정 12 (옵션 G-2): 3 옵션 + 자유 텍스트 선택
// - 결정 13 (옵션 H-3): lore_extraction_feedback INSERT (4-tuple 영속화)
// - 결정 30 (옵션 F-1): 기 피드백 = server fetch (1회 사양 = server 재검증)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";

export const runtime = "nodejs";

type ExtractionScope = "both" | "characters_only" | "worldview_only";
type FeedbackRating = "적합" | "부분 적합" | "부적합";

const VALID_RATINGS: readonly FeedbackRating[] = ["적합", "부분 적합", "부적합"];

const FEEDBACK_COMMENT_MAX = 2000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json(
      { error: "사용자 정보를 찾을 수 없습니다." },
      { status: 403 },
    );
  }

  const { workId } = await params;
  const workIdNum = Number(workId);
  if (!Number.isFinite(workIdNum)) {
    return NextResponse.json({ error: "잘못된 작품 ID 입니다." }, { status: 400 });
  }

  let body: { feedback_rating?: unknown; feedback_comment?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const rating = body.feedback_rating;
  if (
    typeof rating !== "string" ||
    !(VALID_RATINGS as readonly string[]).includes(rating)
  ) {
    return NextResponse.json(
      { error: "유효하지 않은 피드백 옵션입니다." },
      { status: 400 },
    );
  }

  const commentRaw =
    typeof body.feedback_comment === "string"
      ? body.feedback_comment.trim()
      : "";
  if (commentRaw.length > FEEDBACK_COMMENT_MAX) {
    return NextResponse.json(
      { error: "추가 의견이 너무 깁니다." },
      { status: 400 },
    );
  }
  const comment = commentRaw.length > 0 ? commentRaw : null;

  // 작품 fetch + 소유 검증 + 추출 사양 검증 (server 재검증, 게이트 1 정합).
  const { data: work, error: workErr } = await supabase
    .from("works")
    .select(
      "id, author_id, world_setting, character_settings, worldview_source, characters_source",
    )
    .eq("id", workIdNum)
    .single();
  if (workErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json(
      { error: "이 작품에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const isWorldviewExtracted = work.worldview_source === "auto_extracted";
  const isCharactersExtracted = work.characters_source === "auto_extracted";
  if (!isWorldviewExtracted && !isCharactersExtracted) {
    return NextResponse.json(
      { error: "추출 진행한 작품이 아닙니다." },
      { status: 400 },
    );
  }

  let extractionScope: ExtractionScope;
  if (isWorldviewExtracted && isCharactersExtracted) {
    extractionScope = "both";
  } else if (isWorldviewExtracted) {
    extractionScope = "worldview_only";
  } else {
    extractionScope = "characters_only";
  }

  // 1회 사양 (옵션 F-1: 기 피드백 server 재검증).
  const service = createSupabaseServiceRole();
  const { data: existing } = await service
    .from("lore_extraction_feedback")
    .select("id")
    .eq("work_id", workIdNum)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "이미 제출한 피드백입니다." },
      { status: 409 },
    );
  }

  // INSERT (4-tuple 영속화).
  const { error: insErr } = await service
    .from("lore_extraction_feedback")
    .insert({
      work_id: workIdNum,
      user_id: appUser.id,
      extracted_worldview: isWorldviewExtracted ? work.world_setting : null,
      extracted_characters: isCharactersExtracted
        ? work.character_settings
        : null,
      extraction_scope: extractionScope,
      feedback_rating: rating,
      feedback_comment: comment,
    });
  if (insErr) {
    console.error("lore-feedback insert:", insErr.message);
    return NextResponse.json(
      { error: "피드백 저장에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
