import { NextResponse } from "next/server";

const MESSAGES = [
  "스튜디오 불러오는 중...",
  "펜에 잉크 채우는 중..",
  "맞춤법 검수중..",
] as const;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");
  const providerErrorDesc = searchParams.get("error_description");

  if (providerError) {
    const q = new URLSearchParams({
      error: "naver",
      detail: providerErrorDesc ?? providerError,
    });
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  const msgJson = JSON.stringify(MESSAGES);
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>로그인 처리 중…</title>
    <style>
      body { margin:0; background:#09090b; color:#f4f4f5; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif; }
      .wrap { height:100vh; width:100%; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:100%; max-width:420px; border:1px solid rgba(63,63,70,.9); background: rgba(24,24,27,.4); backdrop-filter: blur(8px); border-radius: 16px; padding: 40px; text-align:center; box-shadow: 0 20px 60px rgba(0,0,0,.55); }
      .brand { font-size: 24px; font-weight: 800; letter-spacing:-0.02em; }
      .sub { margin-top: 4px; font-size: 12px; color: #71717a; }
      .spin { margin: 28px auto 0; width:40px; height:40px; border-radius:999px; border: 2px solid rgba(82,82,91,.9); border-top-color: rgba(34,211,238,.95); animation: s 1s linear infinite; }
      @keyframes s { to { transform: rotate(360deg); } }
      .msg { margin-top: 16px; font-size: 14px; color: #a1a1aa; min-height: 20px; }
      .err { margin-top: 16px; font-size: 14px; color: #f87171; background: rgba(239,68,68,.08); padding: 10px 12px; border-radius: 10px; display:none; }
      a { color: #67e8f9; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="brand">Novel Agent</div>
        <div class="sub">로그인 처리 중…</div>
        <div class="spin" role="status" aria-label="로딩 중"></div>
        <div id="msg" class="msg" aria-live="polite"></div>
        <div id="err" class="err"></div>
        <div id="back" style="margin-top: 12px; display:none;">
          <a href="/login">로그인 페이지로 돌아가기</a>
        </div>
      </div>
    </div>
    <script>
      const M = ${msgJson};
      const msgEl = document.getElementById('msg');
      const errEl = document.getElementById('err');
      const backEl = document.getElementById('back');
      let i = 0;
      function tick() {
        msgEl.textContent = M[i % M.length];
        i++;
      }
      tick();
      setInterval(tick, 3000);

      (async () => {
        const code = ${JSON.stringify(code)};
        const state = ${JSON.stringify(state)};
        if (!code || !state) {
          errEl.textContent = '로그인 코드가 없습니다. 다시 시도해 주세요.';
          errEl.style.display = 'block';
          backEl.style.display = 'block';
          return;
        }
        try {
          const q = new URLSearchParams({ code, state });
          const res = await fetch('/api/auth/naver/complete?' + q.toString(), { method: 'POST', credentials: 'include', cache: 'no-store' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok !== true) throw new Error(data.error || '로그인 처리에 실패했습니다.');
          location.replace(data.redirectPath || '/studio');
        } catch (e) {
          errEl.textContent = (e && e.message) ? e.message : '로그인 처리에 실패했습니다.';
          errEl.style.display = 'block';
          backEl.style.display = 'block';
        }
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
