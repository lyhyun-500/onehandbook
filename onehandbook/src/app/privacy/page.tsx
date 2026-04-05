import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, CONTACT_EMAIL } from "@/config/site";

export const metadata: Metadata = {
  title: `개인정보처리방침 · ${SITE_NAME}`,
  description: `${SITE_NAME} 개인정보 수집·이용 안내`,
};

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-zinc-50">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-zinc-500">
          시행일: {new Date().toLocaleDateString("ko-KR", { dateStyle: "long" })}
          <span className="ml-2 text-zinc-600">
            (서비스 개선에 따라 개정될 수 있습니다)
          </span>
        </p>

        <div className="prose prose-invert prose-sm mt-8 max-w-none space-y-8 text-zinc-300 prose-headings:text-zinc-100 prose-p:leading-relaxed prose-li:marker:text-cyan-600">
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제1조 (처리 목적)
            </h2>
            <p>
              {SITE_NAME}(이하 &quot;서비스&quot;)는 회원 가입·로그인, 서비스
              제공·고객 지원, 부정 이용 방지, 법령 준수를 위해 필요한 범위에서
              개인정보를 처리합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제2조 (수집 항목)
            </h2>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li>
                이메일 계정: 이메일 주소, 비밀번호(암호화 저장), 닉네임 등
                가입 시 입력 정보
              </li>
              <li>
                소셜 로그인: 해당 제공자가 전달하는 식별자·프로필 정보(이름,
                이메일 등은 제공 정책에 따름)
              </li>
              <li>
                서비스 이용 과정: 업로드·입력한 원고 및 메타데이터, 분석 요청
                기록, 기기·접속 로그(보안·통계 목적)
              </li>
              <li>
                휴대폰 인증 시: 인증에 필요한 최소 정보(서비스 내 별도 안내)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제3조 (보유·이용 기간)
            </h2>
            <p>
              회원 탈퇴 또는 처리 목적 달성 후 지체 없이 파기합니다. 다만
              관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제4조 (제3자 제공·처리 위탁)
            </h2>
            <p>
              원칙적으로 이용자 동의 없이 외부에 제공하지 않습니다. 클라우드·
              AI API 등 서비스 운영을 위한 처리 위탁이 있는 경우 계약 등으로
              안전성을 확보하고, 목적 외 이용을 제한합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제5조 (이용자의 권리)
            </h2>
            <p>
              개인정보 열람·정정·삭제·처리 정지 요청, 동의 철회를 할 수
              있습니다. 문의 채널을 통해 요청해 주시면 지체 없이
              조치하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제6조 (마케팅 수신)
            </h2>
            <p>
              이벤트·소식 등 마케팅 정보는 별도 동의를 받은 경우에만 발송하며,
              언제든 수신 거부할 수 있습니다.
            </p>
          </section>

          <section id="inquiry" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-zinc-100">문의</h2>
            <p className="text-zinc-400">
              개인정보 관련 문의는 아래로 연락 주세요.
            </p>
            {CONTACT_EMAIL ? (
              <p className="mt-2">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            ) : (
              <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
                운영 이메일이 아직 공개되지 않았습니다.{" "}
                <code className="text-zinc-400">
                  NEXT_PUBLIC_CONTACT_EMAIL
                </code>
                을 설정하면 표시됩니다.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
