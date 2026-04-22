import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
const admin = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data } = await admin
    .from("users")
    .select("id, email, role, login_provider, deleted_at")
    .eq("role", "admin");
  console.log("admins:");
  for (const r of data ?? []) console.log(" ", r);
})();
