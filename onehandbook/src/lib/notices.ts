export interface Notice {
  id: string;
  title: string;
  /** yyyy.MM.dd */
  date: string;
  body: string;
}

const NOTICES_RAW: Notice[] = [
  {
    id: "1",
    title: "Novel Agent 스튜디오 안내",
    date: "2026.03.31",
    body:
      "작가 스튜디오에서 작품·회차를 등록하고 AI 흥행 분석을 이용할 수 있습니다. NAT 잔액은 상단에서 항상 확인할 수 있으며, 충전은 NAT 충전 페이지에서 안내를 참고해 주세요.",
  },
  {
    id: "2",
    title: "서비스 이용 및 문의",
    date: "2026.03.31",
    body:
      "이용약관·개인정보 처리에 대한 내용은 하단 푸터의 이용약관 링크에서 확인할 수 있습니다. 서비스 관련 문의는 이용약관의 문의 안내를 참고해 주세요.",
  },
];

export const NOTICES: Notice[] = [...NOTICES_RAW].sort((a, b) =>
  b.date.localeCompare(a.date),
);
