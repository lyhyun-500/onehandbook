import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser, setUserLoginProvider } from "@/lib/supabase/appUser";
import {
  exchangeNaverCode,
  fetchNaverProfile,
  naverSyntheticEmail,
} from "@/lib/auth/naverOAuth";

const STATE_COOKIE = "naver_oauth_state";

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  let page = 1;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (!data.nextPage) return null;
    page = data.nextPage;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const err = searchParams.get("error");
  const errDesc = searchParams.get("error_description");
  if (err) {
    const q = new URLSearchParams({ error: "naver", detail: errDesc ?? err });
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=naver&detail=missing_code`);
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    return NextResponse.redirect(`${origin}/login?error=naver&detail=invalid_state`);
  }

  const redirectUri = `${origin}/auth/callback/naver`;

  let profile;
  try {
    const { access_token } = await exchangeNaverCode({
      code,
      state,
      redirectUri,
    });
    profile = await fetchNaverProfile(access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "naver_oauth_failed";
    return NextResponse.redirect(
      `${origin}/login?error=naver&detail=${encodeURIComponent(msg)}`
    );
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.redirect(
      `${origin}/login?error=naver&detail=missing_service_role`
    );
  }

  const email = naverSyntheticEmail(profile.id);
  const displayName = profile.name || profile.nickname || "네이버 사용자";
  const user_metadata: Record<string, unknown> = {
    naver_id: profile.id,
    full_name: displayName,
    name: displayName,
    avatar_url: profile.profile_image,
    provider: "naver",
  };
  if (profile.email) {
    user_metadata.naver_email = profile.email;
  }

  const tempPassword = randomBytes(32).toString("base64url");

  let userId = await findUserIdByEmail(admin, email);
  if (userId) {
    const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata,
    });
    if (upErr) {
      return NextResponse.redirect(
        `${origin}/login?error=naver&detail=${encodeURIComponent(upErr.message)}`
      );
    }
  } else {
    const { data: created, error: crErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata,
    });
    if (crErr || !created.user) {
      return NextResponse.redirect(
        `${origin}/login?error=naver&detail=${encodeURIComponent(crErr?.message ?? "create_user")}`
      );
    }
  }

  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: tempPassword,
  });

  if (signErr) {
    return NextResponse.redirect(
      `${origin}/login?error=naver&detail=${encodeURIComponent(signErr.message)}`
    );
  }

  await syncAppUser(supabase);
  await setUserLoginProvider(supabase, "naver");

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  let redirectPath = "/dashboard";
  if (sessionUser) {
    const { data: consentRow } = await supabase
      .from("users")
      .select("terms_agreed_at")
      .eq("auth_id", sessionUser.id)
      .maybeSingle();
    if (!consentRow?.terms_agreed_at) {
      redirectPath = "/auth/welcome";
    }
  }

  cookieStore.set(STATE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
