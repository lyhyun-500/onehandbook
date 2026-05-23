import { createClient } from "@/lib/supabase/server";
import { SampleTourClient } from "@/components/sample/SampleTourClient";

/**
 * /sample — 비로그인/로그인 동등 접근 샘플 분석 둘러보기 (B-2 신규 라우트).
 *
 * 가드 0 (requireAppUser 호출 안 함) — 비로그인 사용자도 SampleAnalysisReport 본문 노출.
 * supabase.auth.getUser() 만 호출 — 로그인 사용자 식별용 (「내 작품으로 시작하기」 분기).
 *
 * 비로그인: LoginModal → OAuth → /studio
 * 로그인: 즉시 /studio redirect (LoginModal 어색 회피)
 */
export default async function SamplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <SampleTourClient initialUser={user} />;
}
