"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-zinc-100">
        <h1 className="text-lg font-semibold">문제가 발생했습니다</h1>
        <p className="max-w-md text-center text-sm text-zinc-400">
          일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </body>
    </html>
  );
}
