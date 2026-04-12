import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/config/site";
import {
  isLikelyNonRoutableAuthEmail,
  isValidReplyRecipientEmail,
} from "@/lib/inquiryReplyEmail";

export const runtime = "nodejs";

const TITLE_MAX = 200;
const CONTENT_MAX = 8000;

const DEFAULT_INQUIRY_TO = "agent@novelagent.kr";
const DEFAULT_RESEND_FROM = "Novel Agent <onboarding@resend.dev>";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "메일 발송 설정(RESEND_API_KEY)이 없습니다." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { title?: unknown; content?: unknown; replyEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const replyEmailRaw =
    typeof body.replyEmail === "string" ? body.replyEmail.trim() : "";

  const title =
    typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
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

  const to = (process.env.INQUIRY_TO_EMAIL ?? DEFAULT_INQUIRY_TO).trim();
  const from = (process.env.RESEND_FROM ?? DEFAULT_RESEND_FROM).trim();

  const sessionEmailLine =
    user.email != null && user.email.length > 0
      ? `로그인에 연결된 이메일(참고·SNS 플레이스홀더일 수 있음): ${user.email}`
      : "로그인에 연결된 이메일: 없음";

  const text = [
    `[${SITE_NAME}] 1:1 문의`,
    "",
    `제목: ${title}`,
    "",
    "———— 내용 ————",
    content,
    "",
    "———— 메타 ————",
    `User ID (auth): ${user.id}`,
    sessionEmailLine,
    `답장 대상(Reply-To): ${resolvedReplyTo}`,
  ].join("\n");

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: resolvedReplyTo,
      subject: `[${SITE_NAME}] ${title}`.slice(0, 998),
      text,
    });

    if (error) {
      console.error("resend inquiry:", error);
      return NextResponse.json(
        { error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error("resend inquiry:", e);
    return NextResponse.json(
      { error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
