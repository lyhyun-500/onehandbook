import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser, setUserLoginProvider } from "@/lib/supabase/appUser";

const OHB_SESSION_HINT_COOKIE = "ohb_session_hint";

function resolveProvider(raw: string | null): "google" | "naver" | null {
  if (raw === "google" || raw === "naver") return raw;
  return null;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const provider = resolveProvider(searchParams.get("provider"));

  if (!code) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "auth_failed" },
      { status: 400 }
    );
  }

  after(async () => {
    try {
      await syncAppUser(supabase);
      if (provider) await setUserLoginProvider(supabase, provider);
    } catch (e) {
      console.warn("post-login sync(after) failed:", e);
    }
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OHB_SESSION_HINT_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
  });
  return res;
}

