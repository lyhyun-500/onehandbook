/**
 * coin_balance vs SUM(coin_logs.amount) 정합 검증 (관리용).
 *
 * 사용: cd onehandbook && npx tsx scripts/reconcile-coin-balances.ts
 * 필요: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function main() {
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("admin_coin_balance_mismatches");

  if (error) {
    console.error("admin_coin_balance_mismatches:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Array<{
    user_id: number;
    coin_balance: number;
    ledger_sum: number;
  }>;

  if (rows.length === 0) {
    console.log("OK: 모든 활성 유저에서 coin_balance = SUM(coin_logs.amount) 입니다.");
    process.exit(0);
  }

  console.error(`불일치 ${rows.length}건:`);
  for (const r of rows) {
    console.error(
      `  user_id=${r.user_id} coin_balance=${r.coin_balance} ledger_sum=${r.ledger_sum} diff=${r.coin_balance - Number(r.ledger_sum)}`
    );
  }
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
