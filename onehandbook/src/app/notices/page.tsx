import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";

const ANNOUNCEMENTS: {
  id: string;
  title: string;
  date: string;
  body: string;
}[] = [
  {
    id: "1",
    title: "Novel Agent 스튜디오 안내",
    date: "2026-03-31",
    body:
      "작가 스튜디오에서 작품·회차를 등록하고 AI 흥행 분석을 이용할 수 있습니다. NAT 잔액은 상단에서 항상 확인할 수 있으며, 충전은 NAT 충전 페이지에서 안내를 참고해 주세요.",
  },
  {
    id: "2",
    title: "서비스 이용 및 문의",
    date: "2026-03-31",
    body:
      "이용약관·개인정보 처리에 대한 내용은 하단 푸터의 이용약관 링크에서 확인할 수 있습니다. 서비스 관련 문의는 이용약관의 문의 안내를 참고해 주세요.",
  },
];

export default async function NoticesPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);
  const natBalance = appUser.coin_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader email={appUser.email} natBalance={natBalance} />

      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-12">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/90">
          안내
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">공지사항</h1>
        <p className="mt-2 text-sm text-zinc-400">
          운영 공지·업데이트 소식을 이 페이지에서 안내합니다.
        </p>

        <ul className="mt-10 space-y-6">
          {ANNOUNCEMENTS.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg shadow-black/20"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  {item.title}
                </h2>
                <time
                  dateTime={item.date}
                  className="text-xs tabular-nums text-zinc-500"
                >
                  {item.date}
                </time>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                <CopyWithBreaks as="span" className="block">
                  {item.body}
                </CopyWithBreaks>
              </p>
            </li>
          ))}
        </ul>

        <Link
          href="/studio"
          className="mt-10 inline-flex text-sm text-zinc-500 transition-colors hover:text-cyan-300"
        >
          ← 스튜디오로
        </Link>
      </main>
    </div>
  );
}
