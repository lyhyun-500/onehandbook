/** 브라우저 탭·헤더 등 공통 표시 이름 */
export const SITE_NAME = "Novel Agent";

export const SITE_DESCRIPTION =
  "웹소설 흥행 분석 — 플랫폼·장르·세계관에 맞춘 AI 에이전트";

const DEFAULT_CONTACT_EMAIL = "agent@novelagent.kr";

/** 문의 메일 — `NEXT_PUBLIC_CONTACT_EMAIL`로 재정의 가능, 미설정·빈 값은 기본 주소 */
export const CONTACT_EMAIL = (() => {
  const v = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (typeof v !== "string") return DEFAULT_CONTACT_EMAIL;
  const t = v.trim();
  return t || DEFAULT_CONTACT_EMAIL;
})();

export function contactMailtoHref(): string | null {
  if (!CONTACT_EMAIL) return null;
  const subject = encodeURIComponent(`[${SITE_NAME}] 서비스 문의`);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}`;
}

/** 푸터·비즈니스 안내용 — 제목에 비즈니스 문의 표기 */
export function businessContactMailtoHref(): string | null {
  if (!CONTACT_EMAIL) return null;
  const subject = encodeURIComponent(`[${SITE_NAME}] 비즈니스 문의`);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}`;
}

/** 플로팅 문의 패널 안내 — 필요 시 수정 */
export const SUPPORT_HOURS_LINE =
  "평일 10:00 ~ 18:00 · 점심시간·공휴일 제외 (순차 답변)";

/** 제목·본문 포함 mailto (클라이언트에서 호출) */
export function buildInquiryMailtoHref(title: string, body: string): string | null {
  if (!CONTACT_EMAIL) return null;
  const subject = encodeURIComponent(`[${SITE_NAME}] ${title.trim()}`);
  const text = encodeURIComponent(body.trim());
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${text}`;
}
