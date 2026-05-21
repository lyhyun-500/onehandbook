import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthSpinnerClient } from "./AuthSpinnerClient";

/**
 * /auth/spinner — OAuth callback 후 transient 시뮬 페이지 (P-2-2b 분기 정합).
 *
 * oauth-complete handler 가 신규 가입자(onboarding_seen_at IS NULL) 를 이 라우트로 redirect.
 * 재로그인 사용자는 /studio 직접 redirect (이 라우트 미경유).
 *
 * 가드: 비로그인 차단 — OAuth 완료 후만 진입. 비로그인 직접 URL = /login redirect.
 * next 파라미터: 시뮬 종료 후 이동 라우트 (default "/studio").
 */
export default async function AuthSpinnerPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // open redirect 방어: next 가 상대 path("/..." 형태)만 허용
  const safeNext = typeof next === "string" && next.startsWith("/") ? next : "/studio";

  return <AuthSpinnerClient next={safeNext} />;
}
