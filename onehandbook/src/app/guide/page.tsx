import { GuideClient } from "@/components/guide/GuideClient";

/**
 * /guide — 사용 가이드 (HelpPopover 「사용 가이드」 진입).
 *
 * 가드 0 (비로그인 허용) — 비로그인 사용자도 접근 가능.
 * 콘텐츠: 분석 축 6개 / NAT 사용법 / 분석 동선 / 작품 등록 방법 (4 섹션).
 */
export default function GuidePage() {
  return <GuideClient />;
}
