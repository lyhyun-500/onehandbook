import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export const metadata = {
  title: "Novel Agent — 어드민",
};

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/admin", label: "홈" },
  { href: "/admin/users", label: "유저 관리" },
  { href: "/admin/inquiries", label: "문의 관리" },
  { href: "/admin/withdrawals", label: "탈퇴 로그" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  return (
    <div className="min-h-screen bg-admin-bg-page text-admin-text-primary">
      <aside className="fixed left-0 top-0 bottom-0 flex w-60 flex-col border-r border-admin-border bg-admin-bg-page">
        <div className="border-b border-admin-border px-6 py-5">
          <Link
            href="/admin"
            className="text-lg font-semibold text-admin-text-primary"
          >
            Novel Agent
          </Link>
          <div className="mt-1 text-xs text-admin-text-muted">
            Admin Console
          </div>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-6 py-2.5 text-sm text-admin-text-secondary transition-colors hover:bg-admin-bg-hover hover:text-admin-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-admin-border p-4 text-xs text-admin-text-muted">
          <div className="truncate" title={admin.email}>
            {admin.email}
          </div>
          <Link
            href="/"
            className="mt-2 block text-admin-accent hover:text-admin-accent-hover"
          >
            소비자 사이트로 →
          </Link>
        </div>
      </aside>
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
