import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser, setUserLoginProvider } from "@/lib/supabase/appUser";
import {
  exchangeNaverCode,
  fetchNaverProfile,
  naverSyntheticEmail,
} from "@/lib/auth/naverOAuth";
import { getOAuthOriginFromRequest } from "@/lib/oauthCallbackOrigin";

const STATE_COOKIE = "naver_oauth_state";
const OHB_SESSION_HINT_COOKIE = "ohb_session_hint";

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { ok: false, error: "missing_code_or_state" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 400 });
  }

  const origin = getOAuthOriginFromRequest(request);
  const redirectUri = `${origin}/auth/callback/naver`;

  let profile;
  try {
    const { access_token } = await exchangeNaverCode({ code, state, redirectUri });
    profile = await fetchNaverProfile(access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "naver_oauth_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { ok: false, error: "missing_service_role" },
      { status: 500 }
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
  if (profile.email) user_metadata.naver_email = profile.email;

  const stablePassword = createHash("sha256")
    .update(`naver:${profile.id}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`)
    .digest("base64url")
    .slice(0, 48);

  // 멱등: createUser 시도 → 이미 있으면 updateUserById로 stablePassword 보정
  const { error: crErr } = await admin.auth.admin.createUser({
    email,
    password: stablePassword,
    email_confirm: true,
    user_metadata,
  });

  if (crErr) {
    const isAlready =
      /already been registered/i.test(crErr.message) ||
      /already registered/i.test(crErr.message);
    if (!isAlready) {
      return NextResponse.json({ ok: false, error: crErr.message }, { status: 400 });
    }

    // 이미 가입된 계정이면 email로 userId 찾아 비번/메타 동기화
    const anyAdmin = admin.auth.admin as unknown as {
      getUserByEmail?: (email: string) => Promise<{
        data?: { user?: { id?: string } | null } | null;
        error?: { message?: string } | null;
      }>;
      listUsers?: (p: { page: number; perPage: number }) => Promise<{
        data?: { users?: Array<{ id: string; email?: string | null }> | null } | null;
        error?: { message?: string } | null;
      }>;
    };
    let userId: string | null = null;
    if (typeof anyAdmin.getUserByEmail === "function") {
      const r = await anyAdmin.getUserByEmail(email);
      userId = (r.data?.user?.id as string) ?? null;
    }
    if (!userId) {
      // HTTP admin lookup fallback
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (base && key) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(
          `${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
          {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        clearTimeout(t);
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { users?: Array<{ id?: string; email?: string | null }> }
            | Array<{ id?: string; email?: string | null }>
            | null;
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.users)
              ? data.users
              : [];
          const emailNorm = normEmail(email);
          const hit = arr.find((u) => normEmail(String(u.email ?? "")) === emailNorm);
          userId = typeof hit?.id === "string" ? hit.id : null;
        }
      }
    }
    if (!userId && typeof anyAdmin.listUsers === "function") {
      const emailNorm = normEmail(email);
      for (let page = 1; page <= 3; page++) {
        const r = await anyAdmin.listUsers({ page, perPage: 200 });
        const users = r.data?.users ?? [];
        const hit = Array.isArray(users)
          ? users.find((u) => normEmail(String(u.email ?? "")) === emailNorm)
          : undefined;
        if (hit?.id) {
          userId = hit.id;
          break;
        }
        if (!Array.isArray(users) || users.length < 200) break;
      }
    }
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "user_lookup_failed" },
        { status: 400 }
      );
    }
    const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
      password: stablePassword,
      user_metadata,
    });
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
    }
  }

  // 이제 stablePassword로 로그인(세션 쿠키 발급)
  const supabase = await createClient();
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < (crErr ? 3 : 2); attempt++) {
    const r = await supabase.auth.signInWithPassword({ email, password: stablePassword });
    if (!r.error) {
      lastErr = null;
      break;
    }
    lastErr = r.error.message;
    await new Promise((res) => setTimeout(res, 150 * (attempt + 1)));
  }
  if (lastErr) {
    return NextResponse.json({ ok: false, error: lastErr }, { status: 400 });
  }

  after(async () => {
    try {
      await syncAppUser(supabase);
      await setUserLoginProvider(supabase, "naver");
    } catch (e) {
      console.warn("naver post-login sync(after) failed:", e);
    }
  });

  cookieStore.set(STATE_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });

  const res = NextResponse.json({ ok: true, redirectPath: "/studio" });
  res.cookies.set(OHB_SESSION_HINT_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
  });
  return res;
}

