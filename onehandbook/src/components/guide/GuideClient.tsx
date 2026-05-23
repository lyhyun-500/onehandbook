"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { NatChip } from "@/components/atoms/NatChip";

interface GuideSection {
  id: string;
  title: string;
  kicker: string;
}

const SECTIONS: GuideSection[] = [
  { id: "dimensions", title: "분석 축 6개", kicker: "01" },
  { id: "nat", title: "NAT 사용법", kicker: "02" },
  { id: "flow", title: "분석 동선", kicker: "03" },
  { id: "register", title: "작품 등록 방법", kicker: "04" },
];

const DIMENSIONS = [
  {
    label: "도입 후킹",
    desc: "회차 시작 3페이지 안에 독자 시선을 잡는 강도. 회상·전사·인물 등장 방식이 분석 대상.",
  },
  {
    label: "캐릭터 매력",
    desc: "주인공의 내적 갈등·관계 묘사·반응 일관성. 시점 변화 시 캐릭터 통합도 포함.",
  },
  {
    label: "세계관 밀도",
    desc: "배경·시대·규칙 정합. 대사 설명 vs 시각 디테일 균형, 정보 노출 속도.",
  },
  {
    label: "긴장감·전개",
    desc: "씬 단위 갈등 강도와 호흡. 떡밥 회수 패턴, 중반 평탄 구간 진단.",
  },
  {
    label: "감정선",
    desc: "주 감정 외 보조 레이어 (분노·서글픔·환희·체념 등) 표현 두께.",
  },
  {
    label: "독창성",
    desc: "장르 클리셰 사용·변주 정도. 같은 장르 상위작 패턴 대비 차별 지점.",
  },
];

/**
 * 사용 가이드 (/guide) — 비로그인/로그인 동등 접근.
 *
 * 좌측 sticky TOC (lg 이상) + 우측 main content.
 * intersection observer 로 활성 섹션 TOC 하이라이트.
 *
 * 섹션 4건:
 *   1. 분석 축 6개 (dimensions) — sampleAnalysis SAMPLE_DIMENSIONS 정합
 *   2. NAT 사용법 (nat) — lib/nat.ts 정합 (≤6000자=1, 6001~10000자=2, 옵션 +1)
 *   3. 분석 동선 (flow) — 운영 라우트 (/works/[id] → 회차 행 분석 → 회차 상세)
 *   4. 작품 등록 방법 (register) — Claude Code 자율 추가 섹션 (스튜디오 진입점 → 작품 등록 모달)
 */
export function GuideClient() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]!.id);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 가장 위쪽에 보이는 active 섹션 1개만
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const first = visible[0]!;
          setActiveId(first.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const setRef = useMemo(
    () => (id: string) => (el: HTMLElement | null) => {
      if (el) sectionRefs.current.set(id, el);
      else sectionRefs.current.delete(id);
    },
    [],
  );

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-200">
      <header className="border-b border-stone-800/60 px-6 py-5 lg:px-12">
        <Link href="/" aria-label="Novel Agent — 홈" className="inline-flex">
          <Image src="/logo.svg" alt="Novel Agent" width={68} height={48} priority />
        </Link>
      </header>

      <main className="mx-auto flex max-w-[1200px] gap-12 px-6 py-12 lg:px-12">
        <aside className="sticky top-12 hidden h-[calc(100vh-6rem)] w-[240px] shrink-0 flex-col lg:flex">
          <div className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
            사용 가이드
          </div>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const active = activeId === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-baseline gap-2.5 rounded-md border-l-2 px-3 py-2 text-[12.5px] transition-colors ${
                    active
                      ? "border-sky-400 bg-sky-400/[0.06] text-sky-200"
                      : "border-transparent text-stone-400 hover:text-stone-200"
                  }`}
                >
                  <span className="font-mono text-[10px] tabular-nums text-stone-500">
                    {s.kicker}
                  </span>
                  <span className="font-serif">{s.title}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <article className="min-w-0 flex-1 max-w-3xl">
          <div className="mb-12">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
              GUIDE
            </div>
            <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-stone-100">
              Novel Agent 사용 가이드
            </h1>
            <p className="mt-3 max-w-xl font-serif text-[14px] leading-relaxed text-stone-400">
              분석 축, NAT 정책, 동선 — 작가가 자주 묻는 것들을 한 곳에 정리했습니다.
            </p>
          </div>

          <section
            id="dimensions"
            ref={setRef("dimensions")}
            className="scroll-mt-12 border-t border-stone-800/60 pt-10"
          >
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-sky-300/85">
              01
            </div>
            <h2 className="mt-1 font-serif text-[24px] text-stone-100">분석 축 6개</h2>
            <p className="mt-2 font-serif text-[13.5px] leading-relaxed text-stone-400">
              에이전트는 회차 1건당 6개 축으로 점수를 매기고 코멘트를 돌려줍니다.
            </p>
            <div className="mt-6 space-y-3">
              {DIMENSIONS.map((d) => (
                <div
                  key={d.label}
                  className="rounded-lg border border-stone-800/60 bg-stone-900/30 p-5"
                >
                  <h3 className="font-serif text-[15px] text-stone-100">{d.label}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-stone-400">
                    {d.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-stone-800/60 bg-stone-900/30 p-5">
              <h3 className="font-serif text-[14px] text-stone-100">점수 컬러</h3>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-stone-300">90+ 우수</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span className="text-stone-300">80~89 양호</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                  <span className="text-stone-300">70~79 보통</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-400/80" />
                  <span className="text-stone-300">60~69 보완 필요</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  <span className="text-stone-300">&lt;60 큰 보완</span>
                </li>
              </ul>
            </div>
          </section>

          <section
            id="nat"
            ref={setRef("nat")}
            className="mt-16 scroll-mt-12 border-t border-stone-800/60 pt-10"
          >
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-sky-300/85">
              02
            </div>
            <h2 className="mt-1 font-serif text-[24px] text-stone-100">NAT 사용법</h2>
            <p className="mt-2 font-serif text-[13.5px] leading-relaxed text-stone-400">
              NAT = Novel Agent Token. 분석 1회 진행 시 차감되는 크레딧.
              <br />
              가입 시 <NatChip amount={20} size="sm" /> 가 자동 지급됩니다.
            </p>

            <div className="mt-6 rounded-lg border border-stone-800/60 bg-stone-900/30 p-5">
              <h3 className="font-serif text-[15px] text-stone-100">
                단일 회차 분석 (회차당)
              </h3>
              <ul className="mt-3 space-y-1.5 text-[13px] text-stone-300">
                <li>
                  <span className="font-mono tabular-nums text-sky-300/85">≤ 6,000자</span> ·{" "}
                  <span className="text-stone-200">1 NAT</span>
                </li>
                <li>
                  <span className="font-mono tabular-nums text-sky-300/85">
                    6,001 ~ 10,000자
                  </span>{" "}
                  · <span className="text-stone-200">2 NAT</span>
                </li>
                <li className="text-stone-500">
                  (10,000자 상한 — 초과 회차는 분리 권장)
                </li>
              </ul>
              <div className="mt-4 border-t border-stone-800/60 pt-4">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-stone-500">
                  옵션 (선택)
                </div>
                <ul className="mt-2 space-y-1.5 text-[13px] text-stone-300">
                  <li>
                    세계관·인물 설정 포함 ·{" "}
                    <span className="font-mono tabular-nums text-sky-300/85">+1 NAT</span>
                  </li>
                  <li>
                    플랫폼 최적화 분석 (카카오·문피아·네이버) ·{" "}
                    <span className="font-mono tabular-nums text-sky-300/85">+1 NAT</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-stone-800/60 bg-stone-900/30 p-5">
              <h3 className="font-serif text-[15px] text-stone-100">
                일괄 통합 분석 (회차 묶음 1회)
              </h3>
              <ul className="mt-3 space-y-1.5 text-[13px] text-stone-300">
                <li>
                  <span className="text-stone-200">회차당 1 NAT</span> (글자수 무관)
                </li>
                <li>
                  세계관·인물 옵션 +1 / 플랫폼 옵션 +1 (통합 1회)
                </li>
                <li>
                  11화 이상 선택 시 회차 묶음 단위로 나눠 분석 — 2 묶음 이상이면 결과
                  합치기{" "}
                  <span className="font-mono tabular-nums text-sky-300/85">+2 NAT</span>
                </li>
                <li className="text-stone-500">
                  (최대 50화 — 한 번에 처리 가능한 분량)
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-md border border-emerald-400/25 bg-emerald-400/[0.04] p-4 text-[12.5px] text-emerald-200/90">
              차감 시점 — 분석 성공 후. 실패 시 차감 0 (안전).
            </div>
          </section>

          <section
            id="flow"
            ref={setRef("flow")}
            className="mt-16 scroll-mt-12 border-t border-stone-800/60 pt-10"
          >
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-sky-300/85">
              03
            </div>
            <h2 className="mt-1 font-serif text-[24px] text-stone-100">분석 동선</h2>

            <h3 className="mt-6 font-serif text-[16px] text-stone-100">
              단일 회차 분석
            </h3>
            <ol className="mt-3 space-y-2 text-[13px] text-stone-300">
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">1</span>
                <span>
                  스튜디오 →{" "}
                  <span className="font-mono text-stone-100">작품 상세</span> 진입
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">2</span>
                <span>
                  회차 리스트에서{" "}
                  <span className="font-mono text-stone-100">「분석」</span> 버튼 클릭
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">3</span>
                <span>
                  회차 상세 페이지 → 분석 옵션 선택 → NAT 차감 확인 → 실행
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">4</span>
                <span>분석 완료 알림 (백그라운드) → 결과 페이지 이동</span>
              </li>
            </ol>

            <h3 className="mt-8 font-serif text-[16px] text-stone-100">
              일괄 통합 분석
            </h3>
            <ol className="mt-3 space-y-2 text-[13px] text-stone-300">
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">1</span>
                <span>
                  작품 상세 헤더{" "}
                  <span className="font-mono text-stone-100">
                    「일괄 통합 분석」
                  </span>{" "}
                  버튼 클릭
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">2</span>
                <span>
                  모달에서 회차 선택 (체크박스 또는 드래그) → 옵션·플랫폼 선택
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">3</span>
                <span>「실행 확인」 → 「N NAT 차감하고 실행」 (2-step)</span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">4</span>
                <span>
                  「리포트 보관함 가서 보기 →」 또는 닫고 다른 작업 진행 (백그라운드)
                </span>
              </li>
            </ol>

            <h3 className="mt-8 font-serif text-[16px] text-stone-100">결과 조회</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-stone-400">
              <span className="font-mono text-stone-100">리포트 보관함</span> (LeftRail)
              · 작품별 분석 누적 · 개별 회차 / 일괄 통합 두 탭으로 정리.
            </p>
          </section>

          <section
            id="register"
            ref={setRef("register")}
            className="mt-16 scroll-mt-12 border-t border-stone-800/60 pt-10"
          >
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-sky-300/85">
              04
            </div>
            <h2 className="mt-1 font-serif text-[24px] text-stone-100">
              작품 등록 방법
            </h2>
            <p className="mt-2 font-serif text-[13.5px] leading-relaxed text-stone-400">
              스튜디오 진입 후 작품을 1건이라도 등록하면 분석 동선이 활성화됩니다.
            </p>

            <ol className="mt-6 space-y-2 text-[13px] text-stone-300">
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">1</span>
                <span>
                  스튜디오 (작품 0건 시 빈 화면 안 직접 붙여넣기 또는 헤더 「작품 등록」)
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">2</span>
                <span>
                  제목 · 장르 · 연재 상태 · 태그 입력 → 「등록」
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">3</span>
                <span>
                  작품 상세 →{" "}
                  <span className="font-mono text-stone-100">「새 회차」</span> → 회차 본문 입력
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono tabular-nums text-sky-300/85">4</span>
                <span>회차 등록 후 「분석」 또는 「일괄 통합 분석」 진입</span>
              </li>
            </ol>

            <div className="mt-6 rounded-md border border-stone-800/60 bg-stone-900/30 px-4 py-3 text-[12.5px] text-stone-400">
              파일 업로드(txt · docx)는 준비 중입니다. 직접 붙여넣기로 먼저 시작하세요.
            </div>
          </section>

          <div className="mt-16 flex flex-col gap-3 border-t border-stone-800/60 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/sample"
              className="inline-flex items-center gap-1.5 text-[13px] text-sky-300/90 hover:text-sky-200"
            >
              <Sparkles size={13} aria-hidden="true" />
              샘플 분석 둘러보기
            </Link>
            <Link
              href="/account/inquiries"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-stone-400 hover:text-stone-200"
            >
              1:1 문의 <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
