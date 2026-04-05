import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { WelcomeConsentForm } from "./WelcomeConsentForm";

export default async function AuthWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await syncAppUser(supabase);

  const { data: row } = await supabase
    .from("users")
    .select("terms_agreed_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (row?.terms_agreed_at) {
    redirect("/dashboard");
  }

  return <WelcomeConsentForm />;
}
