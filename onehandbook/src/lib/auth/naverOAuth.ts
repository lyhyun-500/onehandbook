const NAVER_TOKEN = "https://nid.naver.com/oauth2.0/token";
const NAVER_PROFILE = "https://openapi.naver.com/v1/nid/me";

export type NaverProfile = {
  id: string;
  email?: string;
  name?: string;
  nickname?: string;
  profile_image?: string;
};

export async function exchangeNaverCode(params: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<{ access_token: string }> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 설정되지 않았습니다.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    state: params.state,
  });

  const res = await fetch(NAVER_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : "네이버 토큰 교환 실패";
    throw new Error(msg);
  }

  const token = json.access_token;
  if (typeof token !== "string") {
    throw new Error("네이버 access_token이 없습니다.");
  }

  return { access_token: token };
}

export async function fetchNaverProfile(
  accessToken: string
): Promise<NaverProfile> {
  const res = await fetch(NAVER_PROFILE, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    resultcode?: string;
    message?: string;
    response?: Record<string, unknown>;
  };

  if (!res.ok || json.resultcode !== "00" || !json.response) {
    throw new Error(
      typeof json.message === "string" ? json.message : "네이버 프로필 조회 실패"
    );
  }

  const r = json.response;
  const id = r.id != null ? String(r.id) : "";
  if (!id) {
    throw new Error("네이버 회원 식별자가 없습니다.");
  }

  return {
    id,
    email: typeof r.email === "string" ? r.email : undefined,
    name: typeof r.name === "string" ? r.name : undefined,
    nickname: typeof r.nickname === "string" ? r.nickname : undefined,
    profile_image:
      typeof r.profile_image === "string" ? r.profile_image : undefined,
  };
}

export function naverSyntheticEmail(naverId: string): string {
  return `naver_${naverId}@users.naver.oauth.local`;
}
