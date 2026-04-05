import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncAppUser, setUserLoginProvider } from "@/lib/supabase/appUser";

function safeNextPath(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncAppUser(supabase);
      await setUserLoginProvider(supabase, "google");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: row } = await supabase
          .from("users")
          .select("terms_agreed_at")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (!row?.terms_agreed_at) {
          return NextResponse.redirect(`${origin}/auth/welcome`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
