import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";

/**
 * 회차 삭제 + 본편 재배치 API — ADR-0032 정합.
 *
 * RPC `delete_episode_and_reorder` 호출 단독 → 응답 분기.
 * 권한 검증 = RPC 안 단독 (세션 단독 확인 path 단독 본 route 안).
 */
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ workId: string; episodeId: string }>;
  },
) {
  const { workId: workIdRaw, episodeId: episodeIdRaw } = await params;
  const workId = parseInt(workIdRaw, 10);
  const episodeId = parseInt(episodeIdRaw, 10);
  if (Number.isNaN(workId) || Number.isNaN(episodeId)) {
    return NextResponse.json(
      { error: "유효하지 않은 id 입니다." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  await requireAppUser(supabase);

  const { data, error } = await supabase.rpc("delete_episode_and_reorder", {
    p_work_id: workId,
    p_episode_id: episodeId,
  });

  if (error) {
    console.error("[delete_episode_and_reorder] rpc error:", error);
    return NextResponse.json(
      { error: "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    deleted_episode_number?: number;
    episode_type?: "episode" | "prologue";
    reordered_count?: number;
    busy_count?: number;
  } | null;

  if (!result?.ok) {
    const code = result?.error ?? "unknown";
    const status =
      code === "forbidden" || code === "user_not_found"
        ? 403
        : code === "not_found"
          ? 404
          : code === "analysis_in_progress"
            ? 409
            : 400;
    const message =
      code === "analysis_in_progress"
        ? "분석 중에는 회차를 삭제할 수 없습니다. 완료 후 다시 시도해 주세요."
        : code === "forbidden"
          ? "이 회차를 삭제할 권한이 없습니다."
          : code === "not_found"
            ? "회차를 찾을 수 없습니다."
            : "삭제에 실패했습니다.";
    return NextResponse.json({ error: message, code }, { status });
  }

  return NextResponse.json({
    ok: true,
    deleted_episode_number: result.deleted_episode_number,
    episode_type: result.episode_type,
    reordered_count: result.reordered_count,
  });
}
