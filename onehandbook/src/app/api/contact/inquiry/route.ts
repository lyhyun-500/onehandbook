import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";
import {
  isLikelyNonRoutableAuthEmail,
  isValidReplyRecipientEmail,
} from "@/lib/inquiryReplyEmail";
import { isInquiryCategory } from "@/lib/inquiry/categories";

export const runtime = "nodejs";

const TITLE_MAX = 200;
const CONTENT_MAX = 8000;

/**
 * ADR-0008: 1:1 문의 = 메일 발송 → DB INSERT 로 전환.
 * 어드민이 /admin/inquiries 에서 답변을 작성하면 notifications 알림이 자동 발송된다.
 *
 * 검증 흐름은 기존과 동일 (제목/본문 길이, 답장 이메일 라우팅 가능 여부).
 * INSERT 실패 시 클라이언트에 500 — 사용자가 재시도 가능하게.
 */
export async function POST(request: Request) {
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
      { status: 403 }
    );
  }

  let body: {
    category?: unknown;
    title?: unknown;
    content?: unknown;
    replyEmail?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const category = isInquiryCategory(body.category) ? body.category : null;
  if (!category) {
    return NextResponse.json(
      { error: "문의 분류를 선택해 주세요." },
      { status: 400 }
    );
  }

  const replyEmailRaw =
    typeof body.replyEmail === "string" ? body.replyEmail.trim() : "";

  const title =
    typeof body.title === "string"
      ? body.title.trim().replace(/\s+/g, " ")
      : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json({ error: "제목을 확인해 주세요." }, { status: 400 });
  }
  if (!content || content.length > CONTENT_MAX) {
    return NextResponse.json({ error: "내용을 확인해 주세요." }, { status: 400 });
  }

  let resolvedReplyTo: string | null = null;
  if (replyEmailRaw && isValidReplyRecipientEmail(replyEmailRaw)) {
    resolvedReplyTo = replyEmailRaw;
  } else if (user.email && !isLikelyNonRoutableAuthEmail(user.email)) {
    resolvedReplyTo = user.email.trim();
  }

  if (!resolvedReplyTo) {
    return NextResponse.json(
      {
        error:
          "답변 받을 이메일을 입력해 주세요. SNS 로그인만 사용 중이면 실제로 받을 수 있는 주소를 적어 주세요.",
      },
      { status: 400 }
    );
  }

  // inquiries 는 service_role only — RLS 정책상 authenticated 직접 INSERT 불가.
  const service = createSupabaseServiceRole();
  const { error: insErr } = await service.from("inquiries").insert({
    user_id: appUser.id,
    user_auth_id: user.id,
    category,
    title,
    content,
    reply_email: resolvedReplyTo,
  });

  if (insErr) {
    console.error("inquiry insert:", insErr.message);
    return NextResponse.json(
      { error: "문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
