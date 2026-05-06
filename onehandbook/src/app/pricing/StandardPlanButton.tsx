"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAnalysisJobs } from "@/contexts/AnalysisJobsContext";
import { openCheckout } from "@/lib/paddle/client";
import { PADDLE_PRICES } from "@/lib/paddle/config";

export function StandardPlanButton({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();
  const { pushToast } = useAnalysisJobs();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;

    if (!userEmail) {
      pushToast({ message: "로그인이 필요합니다. 로그인 페이지로 이동합니다." });
      setBusy(true);
      setTimeout(() => router.push("/login"), 800);
      return;
    }

    setBusy(true);
    try {
      await openCheckout(PADDLE_PRICES.STANDARD_MONTHLY, {
        customerEmail: userEmail,
        onSuccess: () => {
          pushToast({
            message: "결제가 완료되었습니다. 잠시 후 NAT이 충전됩니다.",
          });
        },
        onClose: () => {
          setBusy(false);
        },
      });
    } catch (e) {
      console.error("[pricing] openCheckout 실패:", e);
      pushToast({ message: "결제창을 열지 못했습니다. 잠시 후 다시 시도해주세요." });
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      구독하기
    </button>
  );
}
