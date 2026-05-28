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
    <footer className="border-t border-stone-800/60 bg-stone-950 py-4 text-center text-xs text-stone-400">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6">
        <span className="text-stone-400">
          © {year} {SITE_NAME}
        </span>
        <Link
          href="/terms"
          className="text-stone-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          이용약관
        </Link>
        <Link
          href="/privacy"
          className="text-stone-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          개인정보처리방침
        </Link>
        <Link
          href="/pricing"
          className="text-stone-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          요금 안내
        </Link>
        <Link
          href="/terms#inquiry"
          className="text-stone-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          문의
        </Link>
        {bizMailHref && (
          <a
            href={bizMailHref}
            className="text-stone-400 underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            비즈니스 문의 · {CONTACT_EMAIL}
          </a>
        )}
        <span className="text-stone-400">사업자 등록번호 884-02-03976</span>
      </div>
    </footer>
  );
}
