import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, CONTACT_EMAIL } from "@/config/site";

export const metadata: Metadata = {
  title: `환불 정책 · ${SITE_NAME}`,
  description: `${SITE_NAME} NAT 구매 환불 안내`,
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-cyan-500/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-zinc-100 hover:text-cyan-200"
          >
            ← {SITE_NAME}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 pb-20">
        <h1 className="text-2xl font-bold text-zinc-50">환불 정책</h1>
        <p className="mt-2 text-sm text-zinc-500">
          시행일: {new Date().toLocaleDateString("ko-KR", { dateStyle: "long" })}
        </p>

        <div className="prose prose-invert prose-sm mt-8 max-w-none space-y-8 text-zinc-300 prose-headings:text-zinc-100 prose-p:leading-relaxed prose-li:marker:text-cyan-600">
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">구매 환불</h2>
            <p>
              NAT 크레딧을 유료로 구매하신 경우,{" "}
              <strong className="text-zinc-200">미사용 분에 한해</strong> 결제일
              기준 <strong className="text-zinc-200">7일 이내</strong>에 환불을
              요청하실 수 있습니다. 구체적인 절차·처리 기간은 요청 시 안내드립니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">환불이 어려운 경우</h2>
            <p>
              <strong className="text-zinc-200">분석에 이미 사용된 NAT</strong>
              은 디지털 콘텐츠·서비스가 제공된 것으로 보아 원칙적으로 환불 대상에서
              제외됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">환불 문의</h2>
            <p>
              환불 요청·문의는 아래 메일로 연락 주세요.
            </p>
            <p className="mt-2">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[${SITE_NAME}] 환불 문의`)}`}
                className="text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          <Link
            href="/pricing"
            className="text-zinc-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            요금 안내
          </Link>
          로 돌아가기
        </p>
      </main>
    </div>
  );
}
