// 추출 LLM API — 의제 신규-1+2 단계 C-4 (commit 3) 정합.
//
// LEE 결정 영속화:
// - 결정 7: 추출 NAT 무료
// - 결정 10 (옵션 M-2): 비동기 호출 + 진행 표시 (본 API = 동기 호출, client 진행 표시)
// - 결정 11 (옵션 EX-3): 통합 LLM 호출
// - 결정 12 (옵션 IN-1): NULL column 만 UPDATE (사용자 입력 보존)
// - 결정 28 (옵션 B-1): 분석 대상 회차 본문만 입력
// - 결정 29 (옵션 L-1): Claude API

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";
import { extractLore } from "@/lib/analysis/extractLore";
import { applyLoreExtraction } from "@/lib/analysis/applyLoreExtraction";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  isWorldviewEmpty,
  isCharactersEmpty,
  getLoreNullCase,
} from "@/lib/works/loreCheck";
import {
  parseCharacterSettings,
  parseWorldSetting,
} from "@/components/side-panel/parseWorkJson";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  let body: { episodeId?: unknown };
  try {
    body = (await request.json()) as { episodeId?: unknown };
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const episodeId =
    typeof body.episodeId === "number"
      ? body.episodeId
      : parseInt(String(body.episodeId ?? ""), 10);
  if (!Number.isFinite(episodeId)) {
    return NextResponse.json({ error: "episodeId 가 필요합니다." }, { status: 400 });
  }

  if (!isProviderConfigured("anthropic")) {
    return NextResponse.json(
      { error: "추출에 필요한 API 키가 설정되어 있지 않습니다." },
      { status: 400 },
    );
  }

  // 작품 + 회차 fetch (소유 검증 정합)
  const { data: work, error: workErr } = await supabase
    .from("works")
    .select(
      "id, title, genre, author_id, world_setting, character_settings",
    )
    .eq("id", workIdNum)
    .single();
  if (workErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json(
      { error: "이 작품에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("id, content, work_id")
    .eq("id", episodeId)
    .single();
  if (epErr || !episode || episode.work_id !== workIdNum) {
    return NextResponse.json({ error: "회차를 찾을 수 없습니다." }, { status: 404 });
  }

  // NULL 분기 재검증 (server-side 정합)
  const worldSetting = parseWorldSetting(work.world_setting);
  const characterSettings = parseCharacterSettings(work.character_settings);
  const loreCase = getLoreNullCase(worldSetting, characterSettings);
  if (loreCase === "both_present") {
    return NextResponse.json(
      {
        error: "세계관·인물 양쪽 이미 존재 — 추출 사양 부적용.",
        code: "LORE_ALREADY_PRESENT",
      },
      { status: 400 },
    );
  }

  // 추출 LLM 호출 (Claude API 정합)
  let extracted;
  try {
    extracted = await extractLore({
      workTitle: (work.title as string) ?? "",
      genre: (work.genre as string) ?? "",
      loreNullCase: loreCase,
      episodeBody: (episode.content as string) ?? "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "추출 실패";
    console.error("extract-lore:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 선택적 UPDATE (옵션 IN-1: service_role 정합 — works UPDATE 권한 정합)
  try {
    const service = createSupabaseServiceRole();
    await applyLoreExtraction(service, {
      workId: workIdNum,
      loreCase,
      extracted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lore UPDATE 실패";
    console.error("extract-lore apply:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 사후 검증 사양 영속화 (단계 C-5 lore_extraction_feedback 진입 시 사용)
  const updatedWorldEmpty = isWorldviewEmpty(extracted.worldview);
  const updatedCharsEmpty = isCharactersEmpty(extracted.characters);

  return NextResponse.json({
    ok: true,
    loreCase,
    extracted_worldview: extracted.worldview,
    extracted_characters: extracted.characters,
    worldview_updated: !updatedWorldEmpty,
    characters_updated: !updatedCharsEmpty,
  });
}
