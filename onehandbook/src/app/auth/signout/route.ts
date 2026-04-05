import { createClient } from "@/lib/supabase/server";
import { OHB_AUTH_PERSISTENT_COOKIE } from "@/lib/supabase/authPersistence";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/`, { status: 302 });
  res.cookies.set(OHB_AUTH_PERSISTENT_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return res;
}
