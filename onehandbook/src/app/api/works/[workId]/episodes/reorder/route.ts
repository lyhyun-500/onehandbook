import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";

/**
 * 회차 수동 재정렬 API — ADR-0030 정합.
 *
 * body: { orderedEpisodeIds: number[] }
 *
 * RPC reorder_episodes 호출 → episodes + work_facts.episode_number 동기 갱신.
 * 진행 중 분석 잡 사실 시 = 409 analysis_in_progress (UI + RPC 이중 가드).
 */
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

  const { workId: workIdRaw } = await params;
  const workId = parseInt(workIdRaw, 10);
  if (Number.isNaN(workId)) {
    return NextResponse.json(
      { error: "유효하지 않은 작품 id 입니다." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 },
    );
  }

  const rawIds = body.orderedEpisodeIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json(
      { error: "orderedEpisodeIds 배열이 필요합니다." },
      { status: 400 },
    );
  }
  const orderedEpisodeIds = rawIds
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));
  if (orderedEpisodeIds.length === 0) {
    return NextResponse.json(
      { error: "유효한 episodeId가 없습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("reorder_episodes", {
    p_work_id: workId,
    p_ordered_episode_ids: orderedEpisodeIds,
  });

  if (error) {
    console.error("[reorder_episodes] rpc error:", error);
    return NextResponse.json(
      { error: "재정렬에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    episode_count?: number;
    busy_count?: number;
  } | null;

  if (!result?.ok) {
    const code = result?.error ?? "unknown";
    const status =
      code === "user_not_found" || code === "forbidden"
        ? 403
        : code === "analysis_in_progress"
          ? 409
          : 400;
    const message =
      code === "analysis_in_progress"
        ? "분석 중에는 순서를 변경할 수 없습니다. 완료 후 다시 시도해 주세요."
        : code === "forbidden"
          ? "이 작품을 수정할 권한이 없습니다."
          : code === "ordered_ids_mismatch"
            ? "회차 목록이 작품과 일치하지 않습니다."
            : code === "duplicate_episode_ids"
              ? "중복된 회차 id 가 있습니다."
              : code === "empty_ordered_ids"
                ? "orderedEpisodeIds 가 비어 있습니다."
                : "재정렬에 실패했습니다.";
    return NextResponse.json(
      { error: message, code },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    episode_count: result.episode_count,
  });
}
