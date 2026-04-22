import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Novel Agent — 어드민",
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  return (
    <div className="min-h-screen bg-admin-bg-page text-admin-text-primary">
      <AdminSidebar email={admin.email} />
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
