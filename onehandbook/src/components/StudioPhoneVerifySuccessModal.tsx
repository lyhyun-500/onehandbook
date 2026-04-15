"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CopyWithBreaks } from "@/components/CopyWithBreaks";
import { PHONE_SIGNUP_REWARD_COINS } from "@/config/phoneSignupReward";

/**
 * /verify-phone 인증 성공 후 /studio?phoneVerified=1&phoneReward=0|1 로 진입 시
 * ManuscriptLowVolumeModal 등과 동일한 오버레이(z-[65])로 안내합니다.
 */
export function StudioPhoneVerifySuccessModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"reward" | "none">("none");

  useEffect(() => {
    if (searchParams.get("phoneVerified") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVariant(searchParams.get("phoneReward") === "1" ? "reward" : "none");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [searchParams]);

  const close = useCallback(() => {
    setOpen(false);
    router.replace("/studio", { scroll: false });
  }, [router]);

  if (!open) return null;

  const message =
    variant === "reward"
      ? `인증되었습니다, 감사의 의미로 ${PHONE_SIGNUP_REWARD_COINS}NAT를 지급해드렸습니다.`
      : "인증되었습니다, 이미 인증 보상 이력이 있어 이번에는 제공되지 않습니다";

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-verify-success-title"
        className="w-full max-w-md rounded-xl border border-cyan-500/15 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
      >
        <h2
          id="phone-verify-success-title"
          className="text-lg font-semibold text-zinc-100"
        >
          휴대폰 인증
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <CopyWithBreaks as="span">{message}</CopyWithBreaks>
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
