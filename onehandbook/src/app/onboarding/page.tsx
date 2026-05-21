import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { OnboardingFullscreen } from "@/components/onboarding/OnboardingFullscreen";

/**
 * /onboarding — 신규 작가 풀스크린 온보딩 (05A).
 *
 * 진입 경로 2종 (searchParams.from):
 *   - 기본 (신규 사용자): 가드 4종 (requireAppUser + terms + onboarding_seen_at NULL + works 0)
 *   - from=help (HelpPopover 「샘플 분석 둘러보기」): 가드 2종만 (requireAppUser + terms).
 *                works.length·onboarding_seen_at 검증 우회 — 작품 보유/이미 본 사용자도 진입 가능.
 *
 * 통과 시 OnboardingFullscreen client 렌더.
 * onClose 동작은 from 에 따라 분기 (OnboardingFullscreen 안):
 *   - 기본: onboarding_seen_at = now() UPDATE + /studio router.push
 *   - from=help: UPDATE 생략 (NULL 유지 — 정식 온보딩 path 보존) + /studio router.push
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const isHelpEntry = from === "help";

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

  // help 진입은 작품 보유/이미 본 사용자도 통과. 기본 진입만 추가 가드 4종.
  if (!isHelpEntry) {
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
  }

  return <OnboardingFullscreen authId={user.id} fromHelp={isHelpEntry} />;
}
