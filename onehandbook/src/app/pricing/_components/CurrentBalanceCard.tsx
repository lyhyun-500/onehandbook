import { Coins } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface CurrentBalanceCardProps {
  balance: number;
  /** coin_logs.created_at (적립 최신) — 부재 시 "충전 이력 없음" 표기. */
  lastChargedAt: string | null;
  /** 402 INSUFFICIENT_NAT 진입 (?from=insufficient) 또는 balance === 0 시 amber 톤. */
  lowBalance: boolean;
}

/**
 * 시안 `design_novel/novel-agent/pricing.jsx:82-142` 정합.
 * 비인증 사용자 = balance 0 + lastChargedAt null + 베타 banner 본질 (LEE 결정 Y4).
 */
export function CurrentBalanceCard({
  balance,
  lastChargedAt,
  lowBalance,
}: CurrentBalanceCardProps) {
  const isEmpty = balance === 0 || lowBalance;

  return (
    <section
      className={`relative overflow-hidden rounded-xl border bg-stone-900/60 px-7 py-6 ${
        isEmpty
          ? "border-amber-400/40 ring-1 ring-amber-400/10"
          : "border-sky-400/30 ring-1 ring-sky-400/10"
      }`}
    >
      {/* serial 텍스처 — 우측 상단 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-5 top-4 select-none font-mono text-[10px] uppercase tracking-[0.3em] text-stone-700"
      >
        NAT · BAL · {new Date().getFullYear()}
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        {/* LEFT — big number */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <Coins
              size={12}
              className="text-sky-300/80"
              aria-hidden="true"
            />
            <span className="font-mono uppercase tracking-[0.2em]">
              현재 NAT 잔량
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-3">
            <span
              className={`font-serif text-[64px] font-medium leading-none tabular-nums ${
                isEmpty ? "text-amber-100" : "text-stone-100"
              }`}
            >
              {balance}
            </span>
            <span className="font-mono text-[12px] uppercase tracking-[0.25em] text-sky-300">
              NAT
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-stone-500">
            {isEmpty ? (
              <span className="font-serif text-[13px] text-amber-200">
                NAT가 부족합니다 — 분석을 계속하려면 충전이 필요해요.
              </span>
            ) : (
              <>
                <span>
                  마지막 충전{" "}
                  <span className="text-stone-300">
                    {lastChargedAt
                      ? formatRelativeTime(lastChargedAt)
                      : "이력 없음"}
                  </span>
                </span>
                <span className="text-stone-700">·</span>
                <span>
                  약{" "}
                  <span className="tabular-nums text-stone-300">
                    {Math.floor(balance / 1.6)}
                  </span>
                  회차 분석 가능
                </span>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — beta banner */}
        <div className="shrink-0 rounded-lg border border-sky-400/25 bg-sky-400/[0.05] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/[0.10] px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-sky-200">
              <span
                aria-hidden="true"
                className="h-1 w-1 rounded-full bg-sky-300"
              />
              Beta
            </span>
            <span className="font-serif text-[13px] text-stone-200">
              베타 기간 한정
            </span>
          </div>
          <div className="mt-1.5 text-[11.5px] text-stone-400">
            가입 시{" "}
            <span className="font-mono tabular-nums text-sky-200">20 NAT</span>{" "}
            자동 지급
            <br />· 모든 패키지{" "}
            <span className="text-stone-200">−15% 추가 할인</span> 적용 중
          </div>
        </div>
      </div>
    </section>
  );
}
