/**
 * 로컬 테스트: public.users id=1 에 NAT 충전 (credit_nat RPC).
 * 필요: .env.local 에 SUPABASE_SERVICE_ROLE_KEY (Dashboard > API > service_role)
 *
 * 사용: node scripts/dev-credit-nat-user1.mjs [amount]
 * 기본 amount: 1000
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");

function loadEnv(path) {
  if (!existsSync(path)) {
    console.error("Missing:", path);
    process.exit(1);
  }
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const amount = Math.floor(Number(process.argv[2] ?? "1000"));
if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) {
  console.error("amount must be 1..100000");
  process.exit(1);
}

const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local"
  );
  console.error(
    "Or run SQL in Supabase SQL Editor: onehandbook/scripts/dev-credit-nat-user1.sql"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("credit_nat", {
  p_user_id: 1,
  p_amount: amount,
  p_reason: "manual_adjust",
  p_ref_type: null,
  p_ref_id: null,
  p_metadata: { note: "dev script dev-credit-nat-user1.mjs" },
});

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
