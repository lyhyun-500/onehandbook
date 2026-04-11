/**
 * coin_logs → coin_stats_daily / coin_stats_monthly 배치 적재 (관리용).
 *
 * 사용:
 * - cd onehandbook
 * - npx tsx scripts/refresh-coin-stats.ts --from 2026-04-01 --to 2026-04-10
 *
 * 필요: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });
import { createClient } from "@supabase/supabase-js";

function parseArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  const v = process.argv[idx + 1];
  return typeof v === "string" ? v : null;
}

function todayUtcYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const from = parseArg("--from") ?? todayUtcYmd();
  const to = parseArg("--to") ?? todayUtcYmd();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    console.error("--from/--to 는 YYYY-MM-DD 형식이어야 합니다.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("refresh_coin_stats", {
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("refresh_coin_stats:", error.message);
    process.exit(1);
  }
  const json = data as { ok?: boolean; error?: string } | null;
  if (!json || json.ok !== true) {
    console.error("refresh_coin_stats failed:", json?.error ?? "unknown_error");
    process.exit(2);
  }

  console.log(`OK: coin stats refreshed (${from} ~ ${to})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

