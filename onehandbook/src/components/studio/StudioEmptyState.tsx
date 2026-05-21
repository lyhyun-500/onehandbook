"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Edit3, File, Sparkles } from "lucide-react";
import { AddWorkButton } from "@/app/(app)/studio/AddWorkButton";
import { NatChip } from "@/components/atoms/NatChip";

/**
 * 빈 스튜디오 — works.length === 0 시점 + onboarding_seen_at IS NOT NULL.
 *
 * 시안 design_novel/novel-agent/portfolio-canvas.jsx EmptyStudioFrame 정합.
 * - 좌측 import CTA 2개 (LEE P-2-6 (a) — 둘 다 AddWorkButton 모달 트리거, 파일 업로드는 "준비 중" 안내)
 * - 우측 sub-CTA = 샘플 분석 다시 보기 (랜딩 /#sample) + 가치 제안
 * - NAT 카피 = 20 NAT (운영 정합, 시안 30 폐기)
 */
export function StudioEmptyState({ userId }: { userId: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [fileToast, setFileToast] = useState(false);

  const openModal = () => setModalOpen(true);
  const onFileUploadClick = () => {
    setFileToast(true);
    // toast 자동 dismiss
    window.setTimeout(() => setFileToast(false), 3000);
  };

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

      <div className="mb-8 rounded-xl border border-stone-800/70 bg-gradient-to-br from-stone-900/50 to-stone-900/20 p-8 sm:p-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            <div className="text-[11px] tracking-widest text-sky-300/85">
              첫 작품 등록
            </div>
            <h2 className="mt-2 font-serif text-[24px] leading-snug text-stone-100">
              어떻게 가져올까요?
            </h2>
            <div className="mt-6 space-y-2.5">
              <ImportOption
                icon={<File size={15} aria-hidden="true" />}
                title="원고 파일 업로드"
                sub="txt · docx · 회차별 또는 통합본 (준비 중)"
                onClick={onFileUploadClick}
              />
              <ImportOption
                icon={<Edit3 size={15} aria-hidden="true" />}
                title="직접 붙여넣기"
                sub="에디터에 텍스트 입력"
                primary
                onClick={openModal}
              />
            </div>
            {fileToast && (
              <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 font-mono text-[10.5px] text-amber-200/90">
                · 원고 파일 업로드는 준비 중입니다. 직접 붙여넣기로 먼저 시작하세요.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-stone-700/70 bg-stone-950/30 p-6">
            <div className="text-[10.5px] tracking-widest text-stone-500">
              아직 망설여진다면
            </div>
            <h3 className="mt-2 font-serif text-[17px] leading-snug text-stone-200">
              샘플 분석을 다시 둘러보세요.
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
              에이전트가 어떤 점수와 코멘트를 내놓는지 예시로 확인할 수 있습니다.
            </p>
            <Link
              href="/onboarding?from=help"
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-sky-300/90 hover:text-sky-200"
            >
              <Sparkles size={12} aria-hidden="true" />
              샘플 분석 열기
            </Link>
            <div className="mt-6 border-t border-stone-800/60 pt-4 text-[11px] text-stone-500">
              <div className="mb-2 flex items-center gap-2">
                <span>분석 1회당 1 NAT · 가입 시</span>
                <NatChip amount={20} size="sm" />
                <span>지급</span>
              </div>
              <Link
                href="/billing"
                className="inline-flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-200"
              >
                요금 자세히 보기 <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ValueProp title="분석 1회 = 1 NAT" sub="필요한 만큼만 사용" />
        <ValueProp title="회차마다 6개 축 점수" sub="개선 포인트 코멘트 포함" />
        <ValueProp title="원고 비공개 보관" sub="업로드 후 외부 노출 0" />
      </div>

      <AddWorkButton
        userId={userId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        hideTrigger
      />
    </div>
  );
}

function ImportOption({
  icon,
  title,
  sub,
  primary,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors ${
        primary
          ? "border-sky-400/40 bg-sky-400/[0.06] hover:bg-sky-400/[0.10]"
          : "border-stone-800/60 bg-stone-900/30 hover:border-stone-700"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md ${
          primary
            ? "bg-sky-400/15 text-sky-200"
            : "bg-stone-800/60 text-stone-400"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[14px] text-stone-100">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-stone-500">{sub}</div>
      </div>
      <ChevronRight
        size={13}
        aria-hidden="true"
        className="text-stone-600 group-hover:text-stone-300"
      />
    </button>
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
