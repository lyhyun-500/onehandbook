import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, CONTACT_EMAIL } from "@/config/site";

export const metadata: Metadata = {
  title: `이용약관 · ${SITE_NAME}`,
  description: `${SITE_NAME} 서비스 이용약관`,
};

export default function TermsPage() {
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
        <h1 className="text-2xl font-bold text-zinc-50">이용약관</h1>
        <p className="mt-2 text-sm text-zinc-500">
          시행일: {new Date().toLocaleDateString("ko-KR", { dateStyle: "long" })}
          <span className="ml-2 text-zinc-600">
            (베타·무료 기간 기준, 이후 개정될 수 있습니다)
          </span>
        </p>

        <div className="prose prose-invert prose-sm mt-8 max-w-none space-y-8 text-zinc-300 prose-headings:text-zinc-100 prose-p:leading-relaxed prose-li:marker:text-cyan-600">
          <section>
            <h2 className="text-lg font-semibold text-zinc-100">제1조 (목적)</h2>
            <p>
              본 약관은 {SITE_NAME}(이하 &quot;서비스&quot;)가 제공하는 웹 기반
              도구 및 콘텐츠의 이용 조건과 절차, 이용자와 운영자의 권리·의무를
              정하는 것을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제2조 (용어의 정의)
            </h2>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li>
                &quot;이용자&quot;란 본 약관에 동의하고 서비스에 접속하거나
                회원가입·이용을 하는 자를 말합니다.
              </li>
              <li>
                &quot;콘텐츠&quot;란 이용자가 업로드·입력한 원고, 설정 정보 및
                그에 따르는 메타데이터를 말합니다.
              </li>
              <li>
                &quot;분석 결과&quot;란 AI 등을 통해 생성된 점수·코멘트·리포트
                형태의 출력물을 말합니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제3조 (약관의 효력 및 변경)
            </h2>
            <p>
              서비스 화면에 게시하거나 기타 방법으로 공지한 때부터 약관이
              효력을 가집니다. 운영상·법령상 필요한 경우 사전 고지 후 약관을
              변경할 수 있으며, 중요한 변경 시 합리적인 절차로 안내합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제4조 (서비스의 제공)
            </h2>
            <p>
              서비스는 웹소설 원고 등에 대한 AI 기반 분석·작품 관리 기능을
              제공합니다. 베타 기간에는 기능·과금·한도가 예고 없이 조정될 수
              있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제5조 (이용자의 의무)
            </h2>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li>
                타인의 권리를 침해하거나 불법·음란·혐오적 정보를 게시하지
                않습니다.
              </li>
              <li>
                서비스를 크롤링·역설계·부정 사용하여 시스템에 과부하를 주지
                않습니다.
              </li>
              <li>
                계정 정보를 제3자와 공유하지 않으며, 비밀번호 관리 책임은
                이용자에게 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제6조 (콘텐츠 및 저작권)
            </h2>
            <p>
              이용자는 본인에게 권한 있는 콘텐츠만 업로드해야 합니다. 콘텐츠의
              저작권은 이용자에게 귀속됩니다. 서비스 운영·기술 지원을 위해
              필요한 범위에서 콘텐츠를 처리·저장·표시할 수 있습니다(보관
              기간은 운영 정책 및 설정에 따름).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제7조 (AI 분석 결과)
            </h2>
            <p>
              분석 결과는 참고용 정보이며, 출판·계약·수익 등에 대한 법적·
              금전적 보증을 하지 않습니다. 결과에 따른 이용자의 판단·행위
              책임은 이용자에게 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제8조 (유료 서비스·크레딧)
            </h2>
            <p>
              NAT 등 크레딧·유료 요금제는 별도 공지 및 결제 정책에 따릅니다.
              베타 기간에는 무료 또는 테스트용 잔액으로 제공될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제9조 (서비스 중단)
            </h2>
            <p>
              점검, 장애, 법령, 계약 종료 등 불가피한 경우 서비스 제공을 일시
              또는 영구 중단할 수 있습니다. 가능한 범위에서 사전 또는 사후
              안내합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제10조 (면책)
            </h2>
            <p>
              천재지변, 제3자 서비스(클라우드·AI API 등) 장애, 이용자
              단말·네트워크 문제로 인한 손해에 대해 운영자는 고의 또는 중대한
              과실이 없는 한 책임을 지지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-100">
              제11조 (준거법 및 분쟁)
            </h2>
            <p>
              본 약관은 대한민국 법률에 따르며, 분쟁은 관할 법원 또는
              중재·조정 등 합의된 절차에 따를 수 있습니다.
            </p>
          </section>

          <section id="inquiry" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-zinc-100">문의</h2>
            <p className="text-zinc-400">
              서비스 관련 문의·버그 제보·제휴는 아래로 연락 주세요.
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
                을 설정하면 플로팅 문의 버튼과 이 페이지에 주소가 표시됩니다.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
