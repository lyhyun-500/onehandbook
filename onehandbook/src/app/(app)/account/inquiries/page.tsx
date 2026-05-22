import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { TopBar } from "@/components/shell/TopBar";
import { InquiriesClient } from "./InquiriesClient";
import type { InquiryRowFull } from "@/components/inquiries/InquiryThread";

export default async function MyInquiriesPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  // RLS "Users can view own inquiries" — auth 클라이언트로 본인 row 만 조회됨.
  const { data: rows } = await supabase
    .from("inquiries")
    .select(
      "id, category, title, content, reply_content, replied_at, closed_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const inquiries: InquiryRowFull[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    category: (r.category as string | null) ?? "etc",
    title: (r.title as string | null) ?? "",
    content: (r.content as string | null) ?? "",
    reply_content: (r.reply_content as string | null) ?? null,
    replied_at: (r.replied_at as string | null) ?? null,
    closed_at: (r.closed_at as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? new Date().toISOString(),
  }));

  return (
    <>
      <TopBar
        breadcrumb={["계정"]}
        title="문의함"
        natBalance={appUser.coin_balance ?? 0}
      />
      <main className="h-[calc(100vh-3rem)] min-h-0">
        <InquiriesClient initialInquiries={inquiries} />
      </main>
    </>
  );
}
