import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";

export default async function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 shrink-0 border-b border-cyan-500/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="shrink-0 text-lg font-bold tracking-tight text-zinc-100"
          >
            {SITE_NAME}
          </Link>
          <nav className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:gap-4 text-sm">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-cyan-300/90 transition-colors hover:text-cyan-200"
                >
                  대시보드
                </Link>
                <span className="hidden max-w-[200px] truncate text-zinc-400 md:inline">
                  {user.email}
                </span>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-600 bg-zinc-950/70 px-3 py-1.5 text-sm font-medium text-zinc-100 backdrop-blur-sm transition-colors hover:border-zinc-500 hover:bg-zinc-900/80"
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 font-medium text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-950/70"
              >
                로그인
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
