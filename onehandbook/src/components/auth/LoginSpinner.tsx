"use client";

import Image from "next/image";

export type LoginStage = "auth" | "profile" | "workspace";

const STAGES: Record<
  LoginStage,
  { label: string; sub: string; korean: string }
> = {
  auth: {
    label: "인증 정보 확인 중",
    sub: "OAuth 토큰을 검증하고 있습니다",
    korean: "인증",
  },
  profile: {
    label: "프로필 불러오는 중",
    sub: "작가 계정을 동기화합니다",
    korean: "프로필",
  },
  workspace: {
    label: "작업실 준비 중",
    sub: "최근 작품과 회차를 불러옵니다",
    korean: "작업실",
  },
};

const STAGE_ORDER: LoginStage[] = ["auth", "profile", "workspace"];

export interface LoginSpinnerProps {
  stage?: LoginStage;
}

export function LoginSpinner({ stage = "auth" }: LoginSpinnerProps) {
  const s = STAGES[stage];
  const idx = STAGE_ORDER.indexOf(stage);

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-stone-950 text-stone-200">
      <div className="text-center">
        <div className="mx-auto mb-7 flex justify-center">
          <Image
            src="/logo.svg"
            alt="Novel Agent"
            width={68}
            height={48}
            priority
          />
        </div>

        <div className="relative mx-auto h-14 w-14">
          <svg viewBox="0 0 50 50" className="h-full w-full -rotate-90">
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="currentColor"
              strokeWidth="2"
              className="text-stone-800/80"
              fill="none"
            />
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              className="text-sky-400"
              strokeDasharray="125"
              strokeDashoffset="50"
              style={{
                animation: "na-spin 1.1s linear infinite",
                transformOrigin: "25px 25px",
              }}
            />
          </svg>
          <style>{`@keyframes na-spin { to { transform: rotate(360deg); } } @keyframes na-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
        </div>

        <div
          className="mt-7 font-serif text-[18px] text-stone-100"
          aria-live="polite"
        >
          {s.label}
        </div>
        <div className="mt-1.5 text-[11.5px] text-stone-500">{s.sub}</div>

        <div
          className="mx-auto mt-8 flex w-[280px] items-center justify-between"
          role="progressbar"
          aria-valuenow={idx + 1}
          aria-valuemin={1}
          aria-valuemax={STAGE_ORDER.length}
          aria-label="로그인 진행 단계"
        >
          {STAGE_ORDER.map((step, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium ${
                      done
                        ? "bg-emerald-400/20 text-emerald-300"
                        : active
                          ? "bg-sky-400/20 text-sky-300"
                          : "bg-stone-800 text-stone-600"
                    }`}
                    style={
                      active
                        ? { animation: "na-pulse 1.4s ease-in-out infinite" }
                        : {}
                    }
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[9.5px] tracking-wider ${
                      active
                        ? "text-sky-300"
                        : done
                          ? "text-stone-400"
                          : "text-stone-600"
                    }`}
                  >
                    {STAGES[step].korean}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div
                    className={`mx-2 h-px flex-1 ${
                      i < idx ? "bg-emerald-400/40" : "bg-stone-800"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-[10.5px] text-stone-600">
          잠시만 기다려주세요…
        </div>
      </div>
    </div>
  );
}
