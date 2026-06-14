"use client";

import { useEffect } from "react";

/** 탭 닫기·새로고침·같은 사이트 링크 시 표시 */
export const ANALYSIS_LEAVE_CONFIRM_MESSAGE =
  "분석이 진행 중입니다. 이미 완료된 회차만 저장됩니다.\n\n그래도 이 페이지를 벗어나시겠습니까?";

/** 폼 dirty 안 이탈 confirm 문맥 (M3 — 회차 편집 등 폼 안 사용 사양). */
export const UNSAVED_CHANGES_CONFIRM_MESSAGE =
  "저장하지 않은 변경이 있습니다. 나가시겠습니까?";

let guardCount = 0;
/** 가드 활성화 시점 안 박힌 메시지. 비활성화 시 기본값 복원 사양. */
let currentMessage = ANALYSIS_LEAVE_CONFIRM_MESSAGE;

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
  if (!window.confirm(currentMessage)) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
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
}

/**
 * 분석 요청 / 폼 dirty 안 이탈(새로고침·탭 닫기·내부 링크 click)을 막거나 확인합니다.
 *
 * 가드 path:
 *   - beforeunload — 탭 닫기 / 새로고침 (브라우저 표준).
 *   - click capture — 내부 `<a>` 태그 click (Next.js Link 포함).
 *
 * 브라우저 뒤로가기(popstate) 가드 = 본 hook 안 미진입 사실 (ADR-0030 영속화).
 * App Router 안 history 조작 (router.replace 등) 안 dummy entry 충돌 사실 +
 * popstate 안 이중 뒤로가기 결함 사실 → 가드 path 폐기 사양.
 *
 * 여러 컴포넌트에서 동시에 켜져도 리스너는 한 세트만 사용합니다.
 *
 * `message` 미지정 = 기본 `ANALYSIS_LEAVE_CONFIRM_MESSAGE` 단독. 폼 dirty 안
 * 사용 시 `UNSAVED_CHANGES_CONFIRM_MESSAGE` 인입 사양 정합.
 */
export function useAnalysisNavigationGuard(
  active: boolean,
  message: string = ANALYSIS_LEAVE_CONFIRM_MESSAGE,
) {
  useEffect(() => {
    if (!active) return;
    const was = guardCount;
    guardCount += 1;
    if (was === 0) {
      currentMessage = message;
      attachGlobalListeners();
    }
    return () => {
      guardCount = Math.max(0, guardCount - 1);
      if (guardCount === 0) {
        detachGlobalListeners();
        currentMessage = ANALYSIS_LEAVE_CONFIRM_MESSAGE;
      }
    };
  }, [active, message]);
}
