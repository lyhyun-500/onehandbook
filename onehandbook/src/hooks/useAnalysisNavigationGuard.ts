"use client";

import { useEffect } from "react";

/** 탭 닫기·새로고침·같은 사이트 링크·뒤로 가기 시 표시 */
export const ANALYSIS_LEAVE_CONFIRM_MESSAGE =
  "분석이 진행 중입니다. 이미 완료된 회차만 저장됩니다.\n\n그래도 이 페이지를 벗어나시겠습니까?";

const GUARD_STATE_KEY = "__analysisNavGuard";

let guardCount = 0;
let ignorePopstate = false;

function shouldInterceptAnchor(a: HTMLAnchorElement): boolean {
  if (a.target === "_blank" || a.download) return false;
  const href = a.getAttribute("href");
  if (href == null || href === "" || href.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
  try {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    const here = new URL(window.location.href);
    if (url.pathname === here.pathname && url.search === here.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

let beforeUnloadAttached = false;
let clickAttached = false;
let popstateAttached = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (guardCount <= 0) return;
  e.preventDefault();
  e.returnValue = "";
}

function onDocumentClickCapture(e: MouseEvent) {
  if (guardCount <= 0) return;
  const el = e.target;
  if (!(el instanceof Element)) return;
  const a = el.closest("a");
  if (!a || !(a instanceof HTMLAnchorElement)) return;
  if (!shouldInterceptAnchor(a)) return;
  if (!window.confirm(ANALYSIS_LEAVE_CONFIRM_MESSAGE)) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
  }
}

function onPopState() {
  if (ignorePopstate || guardCount <= 0) return;

  if (window.confirm(ANALYSIS_LEAVE_CONFIRM_MESSAGE)) {
    return;
  }

  ignorePopstate = true;
  window.history.go(1);
  window.setTimeout(() => {
    ignorePopstate = false;
  }, 0);
}

/** 뒤로 가기 1단계를 확인 대화상자로 넘기기 위해 같은 URL 엔트리를 하나 쌓음 */
function pushGuardHistoryEntry() {
  try {
    window.history.pushState(
      { [GUARD_STATE_KEY]: true },
      "",
      window.location.href
    );
  } catch {
    /* ignore */
  }
}

function attachGlobalListeners() {
  if (!beforeUnloadAttached) {
    window.addEventListener("beforeunload", onBeforeUnload);
    beforeUnloadAttached = true;
  }
  if (!clickAttached) {
    document.addEventListener("click", onDocumentClickCapture, true);
    clickAttached = true;
  }
  if (!popstateAttached) {
    window.addEventListener("popstate", onPopState);
    popstateAttached = true;
  }
}

function detachGlobalListeners() {
  if (beforeUnloadAttached) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    beforeUnloadAttached = false;
  }
  if (clickAttached) {
    document.removeEventListener("click", onDocumentClickCapture, true);
    clickAttached = false;
  }
  if (popstateAttached) {
    window.removeEventListener("popstate", onPopState);
    popstateAttached = false;
  }
}

/**
 * 분석 요청이 진행 중일 때 이탈(새로고침·탭 닫기·내부 링크·뒤로 가기)을 막거나 확인합니다.
 * 여러 컴포넌트에서 동시에 켜져도 리스너는 한 세트만 사용합니다.
 */
export function useAnalysisNavigationGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const was = guardCount;
    guardCount += 1;
    if (was === 0) {
      attachGlobalListeners();
      pushGuardHistoryEntry();
    }
    return () => {
      guardCount = Math.max(0, guardCount - 1);
      if (guardCount === 0) {
        detachGlobalListeners();
      }
    };
  }, [active]);
}
