import { LoginPageClient } from "./LoginPageClient";
import { resolveNaverLoginEnabledForServer } from "@/lib/config/naverLogin";
import { getOAuthCallbackOrigin } from "@/lib/oauthCallbackOrigin";

/** 정적 프리렌더 시점에만 env가 박히는 문제를 피하기 위해 요청 시 서버에서 플래그를 읽습니다. */
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const oauthCallbackOrigin = await getOAuthCallbackOrigin();
  return (
    <LoginPageClient
      naverLoginEnabled={resolveNaverLoginEnabledForServer()}
      oauthCallbackOrigin={oauthCallbackOrigin}
    />
  );
}
