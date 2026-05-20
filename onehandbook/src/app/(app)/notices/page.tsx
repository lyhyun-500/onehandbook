import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { NOTICES } from "@/lib/notices";
import { NoticesAccordion } from "./NoticesAccordion";

export default async function NoticesPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);
  const natBalance = appUser.coin_balance ?? 0;

  return (
    <>
      <TopBar title="공지사항" natBalance={natBalance} />

      <main className="mx-auto max-w-3xl px-8 py-10">
        <header className="mb-8">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
            안내
          </div>
          <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-stone-100">
            공지사항
          </h1>
          <p className="mt-3 max-w-xl font-serif text-[13.5px] leading-relaxed text-stone-400">
            운영 공지·업데이트 소식을 이 페이지에서 안내합니다. 새 공지는 최상단에 추가됩니다.
          </p>
        </header>

        <NoticesAccordion notices={NOTICES} />

        <div className="mt-10 border-t border-stone-800/60 pt-6">
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-stone-400 hover:text-sky-200"
          >
            ← 스튜디오로
          </Link>
        </div>
      </main>
    </>
  );
}
