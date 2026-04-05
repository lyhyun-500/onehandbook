import { NextResponse } from "next/server";

const STATE_COOKIE = "naver_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "NAVER_CLIENT_ID 가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/auth/callback/naver`;
  const state = crypto.randomUUID();

  const authorize = new URL("https://nid.naver.com/oauth2.0/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("scope", "name email profile_image");

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
