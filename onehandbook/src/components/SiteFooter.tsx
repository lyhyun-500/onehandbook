import Link from "next/link";
import {
  SITE_NAME,
  CONTACT_EMAIL,
  businessContactMailtoHref,
} from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  const bizMailHref = businessContactMailtoHref();
  return (
    <footer className="border-t border-zinc-800/90 bg-zinc-950/80 py-4 text-center text-xs text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6">
        <span className="text-zinc-600">
          © {year} {SITE_NAME}
        </span>
        <Link
          href="/terms"
          className="text-zinc-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
        >
          이용약관
        </Link>
        <Link
          href="/privacy"
          className="text-zinc-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
        >
          개인정보처리방침
        </Link>
        <Link
          href="/pricing"
          className="text-zinc-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
        >
          요금 안내
        </Link>
        <Link
          href="/terms#inquiry"
          className="text-zinc-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
        >
          문의
        </Link>
        {bizMailHref && (
          <a
            href={bizMailHref}
            className="text-zinc-400 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
          >
            비즈니스 문의 · {CONTACT_EMAIL}
          </a>
        )}
      </div>
    </footer>
  );
}
