// /faq — 자주 묻는 질문 (FAQ) page.
// Phase 2-D-10 — 시안 design_novel/novel-agent/faq.jsx 정합.
//
// 인증 사양: (app) route group = 로그인 사용자 전용 (시안 mount = LeftRail + TopBar 안).

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { TopBar } from "@/components/shell/TopBar";
import { FAQClient } from "@/components/faq/FAQClient";

export default async function FAQPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  return (
    <>
      <TopBar
        breadcrumb={["고객센터"]}
        title="자주 묻는 질문"
        natBalance={appUser.coin_balance ?? 0}
      />
      <main className="h-[calc(100vh-3.5rem)] min-h-0">
        <FAQClient />
      </main>
    </>
  );
}
