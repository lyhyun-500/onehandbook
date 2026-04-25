import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type NotificationItem = {
  id: string;
  type: string;
  ref_id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResponse = {
  ok: true;
  notifications: NotificationItem[];
};

/**
 * 본인 알림 최근 N개 (notifications 테이블).
 * RLS 정책 "Users can view own notifications" 가 보장 — auth 클라이언트로 충분.
 *
 * ADR-0008 §7 Q2 옵션 a: 헤더 벨이 analysis outcomes + 이 엔드포인트를
 * 양쪽 fetch 후 합쳐서 표시.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, type, ref_id, title, body, link_url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    // 테이블 미존재 (마이그레이션 미적용) 시에도 기존 알림 시스템이 깨지지 않도록 빈 배열 반환.
    if (error.code === "42P01") {
      return NextResponse.json<NotificationListResponse>({
        ok: true,
        notifications: [],
      });
    }
    console.error("notifications list:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications: NotificationItem[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    type: (r.type as string | null) ?? "",
    ref_id: (r.ref_id as string | null) ?? "",
    title: (r.title as string | null) ?? "",
    body: (r.body as string | null) ?? null,
    link_url: (r.link_url as string | null) ?? null,
    read_at: (r.read_at as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  return NextResponse.json<NotificationListResponse>({
    ok: true,
    notifications,
  });
}
