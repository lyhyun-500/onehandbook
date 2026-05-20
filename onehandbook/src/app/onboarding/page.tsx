import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { OnboardingFullscreen } from "@/components/onboarding/OnboardingFullscreen";

/**
 * /onboarding — 신규 작가 풀스크린 온보딩 (05A).
 *
 * 가드 (server-side):
 *   - requireAppUser (비로그인 → /login)
 *   - terms_agreed_at NULL → /auth/welcome
 *   - onboarding_seen_at NOT NULL → /studio (이미 본 사용자)
 *   - works.length > 0 → /studio (작품 있는 사용자)
 *
 * 통과 시 OnboardingFullscreen client 렌더 (4 닫기 트리거 → onboarding_seen_at UPDATE).
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("terms_agreed_at, onboarding_seen_at")
    .eq("id", appUser.id)
    .maybeSingle();

  if (!userRow?.terms_agreed_at) {
    redirect("/auth/welcome");
  }
  if (userRow.onboarding_seen_at) {
    redirect("/studio");
  }

  const { data: works } = await supabase
    .from("works")
    .select("id")
    .eq("author_id", appUser.id)
    .is("deleted_at", null);

  if ((works ?? []).length > 0) {
    redirect("/studio");
  }

  return <OnboardingFullscreen authId={user.id} />;
}
