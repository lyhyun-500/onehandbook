/**
 * /dev/flags — 디자인 개편 Feature Flag 토글 / 디버깅 페이지.
 *
 * server entry + Suspense — `useSearchParams()` 사용하는 client 본체를
 * 직접 export 하면 Next.js 16 prerender 단계에서 CSR-bailout 에러 발생.
 *
 * 어차피 production 에서는 proxy.ts 가 / 로 redirect 하므로 prerender 불필요.
 * `force-dynamic` 으로 정적 빌드 자체를 끈다.
 */

import { Suspense } from "react";
import { DevFlagsClient } from "./DevFlagsClient";

export const dynamic = "force-dynamic";

export default function DevFlagsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-900 p-8 font-mono text-sm text-zinc-400">
          Loading /dev/flags ...
        </div>
      }
    >
      <DevFlagsClient />
    </Suspense>
  );
}
