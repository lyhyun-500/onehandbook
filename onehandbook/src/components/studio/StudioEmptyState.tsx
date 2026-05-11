import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * 빈 스튜디오 — works.length === 0 박힌 사용자 박음 (LEE 시안 정합).
 *
 * LEE 결정 박힌 영역:
 * - 옵션 카드 = 영역 자체 제거 (좌측 영역 부재)
 * - "샘플 분석 열기" = /#sample (랜딩 LiveScoreCard 영역)
 * - NAT 카피 = "20 NAT" (휴대폰 인증 프로모션 정책 정합)
 * - 분석 카피 = "분석 1회당 1 NAT" (시안 그대로 — 최소 기준 마케팅 톤)
 * - 가치 제안 3건 박음 (하단)
 */
export function StudioEmptyState() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
      <div className="mb-8">
        <div className="mb-2 text-[11px] tracking-widest text-sky-300/85">
          작가 스튜디오
        </div>
        <h1 className="font-serif text-[28px] leading-tight tracking-tight text-stone-100">
          작업실에 오신 걸 환영해요,{" "}
          <span className="font-normal text-stone-400">작가님</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-400">
          아직 등록된 작품이 없습니다. 첫 작품을 등록하고 분석을 시작해보세요.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-dashed border-stone-700/60 bg-stone-900/30 p-8">
        <div className="text-[11px] tracking-widest text-stone-400">
          아직 망설여진다면
        </div>
        <h2 className="mt-1 font-serif text-[20px] text-stone-100">
          샘플 분석을 다시 둘러보세요.
        </h2>
        <p className="mt-2 text-sm text-stone-400">
          에이전트가 어떤 점수와 코멘트를 내놓는지 예시로 확인할 수 있습니다.
        </p>

        <Link
          href="/#sample"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-sky-300 hover:text-sky-200"
        >
          <Sparkles size={14} aria-hidden="true" />
          샘플 분석 열기
        </Link>

        <div className="my-5 h-px bg-stone-800/60" />

        <div className="text-[12px] text-stone-400">
          분석 1회당 1 NAT · 가입 시 20 NAT 지급
        </div>
        <Link
          href="/billing"
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-stone-300 hover:text-stone-100"
        >
          요금 자세히 보기 <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ValueProp
          title="분석 1회 = 1 NAT"
          sub="필요한 만큼만 사용"
        />
        <ValueProp
          title="회차마다 6개 축 점수"
          sub="개선 포인트 코멘트 박힘"
        />
        <ValueProp
          title="원고 비공개 보관"
          sub="업로드 후 외부 노출 0"
        />
      </div>
    </div>
  );
}

function ValueProp({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-lg border border-stone-800/60 bg-stone-900/30 p-5">
      <div className="text-[13px] font-medium text-stone-100">{title}</div>
      <div className="mt-1 text-[12px] text-stone-400">{sub}</div>
    </div>
  );
}
