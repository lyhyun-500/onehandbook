"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogOut, MessageSquare, UserMinus, Users } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof Home;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "홈", Icon: Home, exact: true },
  { href: "/admin/users", label: "유저 관리", Icon: Users },
  { href: "/admin/inquiries", label: "문의 관리", Icon: MessageSquare },
  { href: "/admin/withdrawals", label: "탈퇴 로그", Icon: UserMinus },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <aside className="fixed bottom-0 left-0 top-0 flex w-60 flex-col border-r border-admin-border bg-admin-bg-page">
      <div className="border-b border-admin-border px-6 py-5">
        <Link
          href="/admin"
          className="text-lg font-semibold text-admin-text-primary"
        >
          Novel Agent
        </Link>
        <div className="mt-1 text-xs text-admin-text-muted">Admin Console</div>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "relative flex items-center gap-3 px-6 py-2.5 text-sm transition-colors",
                active
                  ? "bg-admin-bg-hover font-medium text-admin-text-primary"
                  : "text-admin-text-secondary hover:bg-admin-bg-hover hover:text-admin-text-primary",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 top-0 w-[3px] bg-admin-accent"
                />
              )}
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-admin-border p-4 text-xs text-admin-text-muted">
        <div className="truncate" title={email}>
          {email}
        </div>
        <Link
          href="/"
          className="mt-2 block text-admin-accent hover:text-admin-accent-hover"
        >
          소비자 사이트로 →
        </Link>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded border border-admin-border bg-admin-bg-page px-3 py-2 text-xs text-admin-text-secondary transition-colors hover:bg-admin-bg-hover hover:text-admin-text-primary"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
