"use client";

import { useEffect, useState } from "react";
import { LoginSpinner, type LoginStage } from "@/components/auth/LoginSpinner";

const STAGE_SEQUENCE: { stage: LoginStage; ms: number }[] = [
  { stage: "auth", ms: 1500 },
  { stage: "profile", ms: 1500 },
  { stage: "workspace", ms: 1500 },
];

/**
 * /auth/spinner transient page client.
 *
 * OAuth callback (oauth-complete handler) 가 신규 가입자(onboarding_seen_at IS NULL) 를
 * 이 라우트로 redirect. 4.5초 LoginSpinner 3단계 시뮬 진행 후 next 라우트로 이동.
 *
 * 백그라운드 fetch 없음 — oauth-complete 가 이미 session 교환 + syncAppUser(after) 완료.
 * 단순 시뮬 시퀀스 + 종료 후 redirect (full reload — session cookie 반영 보장).
 */
export function AuthSpinnerClient({ next }: { next: string }) {
  const [stage, setStage] = useState<LoginStage>("auth");

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const advance = (idx: number) => {
      if (cancelled) return;
      if (idx >= STAGE_SEQUENCE.length) {
        // full reload — session cookie + server-side fetch 정합
        window.location.replace(next);
        return;
      }
      const { stage: s, ms } = STAGE_SEQUENCE[idx]!;
      setStage(s);
      timeoutId = setTimeout(() => advance(idx + 1), ms);
    };

    advance(0);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [next]);

  return <LoginSpinner stage={stage} />;
}
