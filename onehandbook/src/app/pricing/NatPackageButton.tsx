"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAnalysisJobs } from "@/contexts/AnalysisJobsContext";
import { openCheckout } from "@/lib/paddle/client";
import { cn } from "@/lib/utils";

export interface NatPackageButtonProps {
  priceId: string;
  userEmail: string | null;
  userId: number | null;
  recommended?: boolean;
  disabled?: boolean;
}

export function NatPackageButton({
  priceId,
  userEmail,
  userId,
  recommended = false,
  disabled = false,
}: NatPackageButtonProps) {
  const router = useRouter();
  const { pushToast } = useAnalysisJobs();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || disabled) return;
    if (!userEmail) {
      pushToast({ message: "로그인이 필요합니다. 로그인 페이지로 이동합니다." });
      setBusy(true);
      setTimeout(() => router.push("/login"), 800);
      return;
    }

    setBusy(true);
    try {
      await openCheckout(priceId, {
        customerEmail: userEmail,
        customData: userId != null ? { user_id: String(userId) } : undefined,
        onSuccess: () => {
          pushToast({
            message: "결제가 완료되었습니다. 잠시 후 NAT이 충전됩니다.",
          });
        },
        onClose: () => {
          setBusy(false);
        },
      });
    } catch (error) {
      console.error("[NatPackageButton] openCheckout 실패:", error);
      pushToast({
        message: "결제를 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
      });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className={cn(
        "mt-auto flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[12.5px] font-medium transition",
        disabled
          ? "cursor-not-allowed bg-stone-800 text-stone-500"
          : recommended
            ? "bg-sky-400 text-stone-950 hover:bg-sky-300"
            : "bg-sky-500 text-stone-950 hover:bg-sky-400",
        busy && "opacity-60",
      )}
    >
      {busy ? "처리 중..." : "구매하기"}
      {!busy && <ChevronRight size={12} aria-hidden="true" />}
    </button>
  );
}
