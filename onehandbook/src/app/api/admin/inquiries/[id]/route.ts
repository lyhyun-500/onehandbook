import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { getAdminForApi } from "@/lib/admin/getAdminForApi";
import {
  INQUIRY_REPLY_MAX,
  type AdminInquiryItem,
  type AdminInquiryReplyRequest,
  type AdminInquiryReplyResponse,
} from "@/lib/admin/types";

export const runtime = "nodejs";

const NOTIFICATION_TITLE = "문의에 답변이 도착했습니다";
const NOTIFICATION_LINK = "/account/inquiries";

function isUuid(s: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(s);
}

/**
 * 문의 답변 작성 (ADR-0008 §5 Step 1).
 *
 *   1. inquiries.reply_content / replied_at / replied_by UPDATE
 *   2. user_id 가 살아있고 "처음" 답변 작성된 경우 notifications INSERT
 *      (재편집 시 알림 재발송 안 함 → 노이즈 방지)
 *
 * 응답: 갱신된 inquiry 본문 + 알림 발송 여부.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = await getAdminForApi(supabase);
  if (!admin) {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !isUuid(id)) {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: "잘못된 문의 id 입니다." },
      { status: 400 }
    );
  }

  let body: AdminInquiryReplyRequest;
  try {
    body = (await request.json()) as AdminInquiryReplyRequest;
  } catch {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  const replyContent =
    typeof body.reply_content === "string" ? body.reply_content.trim() : "";
  if (!replyContent) {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: "답변 본문을 입력해 주세요." },
      { status: 400 }
    );
  }
  if (replyContent.length > INQUIRY_REPLY_MAX) {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: `답변 본문이 너무 깁니다 (최대 ${INQUIRY_REPLY_MAX}자).` },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceRole();

  // 기존 행 조회 — 존재 여부 + 첫 답변 판정용 (replied_at WAS null).
  const { data: existing, error: selErr } = await service
    .from("inquiries")
    .select(
      "id, user_id, user_auth_id, title, content, reply_email, reply_content, replied_at, replied_by, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (selErr) {
    console.error("admin inquiry select:", selErr.message);
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: selErr.message },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: "문의를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const wasUnreplied = (existing.replied_at as string | null) == null;
  const nowIso = new Date().toISOString();

  const { data: updated, error: updErr } = await service
    .from("inquiries")
    .update({
      reply_content: replyContent,
      replied_at: nowIso,
      replied_by: admin.authId,
    })
    .eq("id", id)
    .select(
      "id, user_id, user_auth_id, title, content, reply_email, reply_content, replied_at, replied_by, created_at"
    )
    .maybeSingle();

  if (updErr || !updated) {
    console.error("admin inquiry update:", updErr?.message);
    return NextResponse.json<AdminInquiryReplyResponse>(
      { ok: false, error: updErr?.message ?? "답변 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  let notificationCreated = false;
  const targetUserId = updated.user_id as number | null;
  if (wasUnreplied && targetUserId != null) {
    const { error: notifErr } = await service.from("notifications").insert({
      user_id: targetUserId,
      type: "inquiry_reply",
      ref_id: String(updated.id),
      title: NOTIFICATION_TITLE,
      body: null,
      link_url: NOTIFICATION_LINK,
    });
    if (notifErr) {
      console.error("admin inquiry notification insert:", notifErr.message);
      // 알림 실패는 답변 저장 자체를 롤백하지 않는다 — 어드민이 답변은 완료한 상태.
    } else {
      notificationCreated = true;
    }
  }

  // 닉네임/이메일 보강 (어드민 UI 가 갱신된 행을 그대로 표시할 수 있도록).
  let userNickname: string | null = null;
  let userEmail: string | null = null;
  if (targetUserId != null) {
    const { data: u } = await service
      .from("users")
      .select("nickname, email")
      .eq("id", targetUserId)
      .maybeSingle();
    userNickname = (u?.nickname as string | null) ?? null;
    userEmail = (u?.email as string | null) ?? null;
  }

  const inquiry: AdminInquiryItem = {
    id: String(updated.id),
    userId: targetUserId,
    userAuthId: (updated.user_auth_id as string | null) ?? null,
    userEmail,
    userNickname,
    title: (updated.title as string | null) ?? "",
    content: (updated.content as string | null) ?? "",
    replyEmail: (updated.reply_email as string | null) ?? "",
    replyContent: (updated.reply_content as string | null) ?? null,
    repliedAt: (updated.replied_at as string | null) ?? null,
    repliedBy: (updated.replied_by as string | null) ?? null,
    createdAt: updated.created_at as string,
  };

  return NextResponse.json<AdminInquiryReplyResponse>({
    ok: true,
    inquiry,
    notificationCreated,
  });
}
