import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { AppShellHeader } from "@/components/AppShellHeader";
import { inquiryCategoryLabel } from "@/lib/inquiry/categories";

type InquiryRow = {
  id: string;
  category: string | null;
  title: string;
  content: string;
  reply_email: string;
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default async function MyInquiriesPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  // RLS: "Users can view own inquiries" — auth 클라이언트로 본인 행만 조회됨.
  const { data: rows, error } = await supabase
    .from("inquiries")
    .select(
      "id, category, title, content, reply_email, reply_content, replied_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const inquiries: InquiryRow[] = (rows ?? []) as InquiryRow[];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={appUser.coin_balance ?? 0}
      />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
          1:1 문의
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">내 문의 내역</h1>
        <p className="mt-2 text-sm text-zinc-400">
          작성하신 문의와 답변을 확인하실 수 있습니다. 답변이 도착하면 헤더 알림으로
          알려드립니다.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            문의 내역을 불러오지 못했습니다: {error.message}
          </div>
        )}

        {!error && inquiries.length === 0 && (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <p className="text-sm text-zinc-400">아직 작성한 문의가 없습니다.</p>
            <p className="mt-2 text-xs text-zinc-500">
              사이트 우측 하단 문의 버튼으로 문의를 보낼 수 있습니다.
            </p>
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {inquiries.map((inq) => {
            const replied = inq.replied_at != null && inq.reply_content != null;
            return (
              <li
                key={inq.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm shadow-black/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-zinc-100">
                      {inq.title}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300">
                        {inquiryCategoryLabel(inq.category ?? "general")}
                      </span>
                      <span>{formatDateTime(inq.created_at)}</span>
                    </div>
                  </div>
                  {replied ? (
                    <span className="shrink-0 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      답변완료
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                      답변 대기중
                    </span>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-300">
                  {inq.content}
                </p>

                {replied && (
                  <div className="mt-5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        Novel Agent 답변
                      </span>
                      <span className="text-xs text-zinc-500">
                        {inq.replied_at ? formatDateTime(inq.replied_at) : ""}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">
                      {inq.reply_content}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Link
          href="/studio"
          className="mt-10 inline-flex rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900/60"
        >
          ← 스튜디오로
        </Link>
      </main>
    </div>
  );
}
