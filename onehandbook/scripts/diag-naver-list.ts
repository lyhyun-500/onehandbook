/**
 * 진단: /admin/users 에서 네이버 유저 미노출 원인 확인.
 * 사용: cd onehandbook && npx tsx scripts/diag-naver-list.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";
import { listAdminUsers } from "@/lib/admin/queries";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function main() {
  if (!url || !key) {
    console.error("env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log("=== [A] 원샷 raw 쿼리 (service_role) ===");
  console.log("SELECT ... WHERE login_provider='naver' AND deleted_at IS NULL");
  {
    const { data, error, count } = await admin
      .from("users")
      .select("id, email, login_provider, role, deleted_at", { count: "exact" })
      .eq("login_provider", "naver")
      .is("deleted_at", null);
    if (error) {
      console.error("raw query error:", error.message);
    } else {
      console.log(`count: ${count}`);
      console.log(`rows: ${data?.length ?? 0}`);
      for (const r of data ?? []) {
        console.log(
          `  id=${r.id} email=${r.email} login_provider=${JSON.stringify(r.login_provider)} role=${JSON.stringify(r.role)} deleted_at=${r.deleted_at ?? "null"}`
        );
      }
    }
  }

  console.log("\n=== [B] login_provider 값 분포 (원시) ===");
  {
    const { data, error } = await admin
      .from("users")
      .select("login_provider")
      .is("deleted_at", null);
    if (error) {
      console.error("dist query error:", error.message);
    } else {
      const dist = new Map<string, number>();
      for (const r of data ?? []) {
        const k = JSON.stringify(r.login_provider);
        dist.set(k, (dist.get(k) ?? 0) + 1);
      }
      for (const [k, v] of dist) console.log(`  ${k}: ${v}`);
    }
  }

  console.log("\n=== [C] listAdminUsers({ provider: 'naver', status: 'active' }) ===");
  {
    const fakeSession = admin; // 어차피 함수 내부에서 service_role 로 다시 만듦
    const r = await listAdminUsers(fakeSession, {
      provider: "naver",
      status: "active",
    });
    console.log(`total=${r.total}, returned=${r.users.length}, page=${r.page}, limit=${r.limit}`);
    for (const u of r.users) {
      console.log(
        `  id=${u.id} email=${u.email} loginProvider=${JSON.stringify(u.loginProvider)} deletedAt=${u.deletedAt ?? "null"}`
      );
    }
  }

  console.log("\n=== [D] listAdminUsers({ provider: 'all', status: 'active' }) 상위 30 ===");
  {
    const r = await listAdminUsers(admin, {
      provider: "all",
      status: "active",
      limit: 30,
    });
    console.log(`total=${r.total}, returned=${r.users.length}`);
    const dist = new Map<string, number>();
    for (const u of r.users) {
      const k = JSON.stringify(u.loginProvider);
      dist.set(k, (dist.get(k) ?? 0) + 1);
    }
    console.log("  loginProvider 분포 (상위 30 내):");
    for (const [k, v] of dist) console.log(`    ${k}: ${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
