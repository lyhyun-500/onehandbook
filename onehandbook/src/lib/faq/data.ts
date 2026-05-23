// FAQ 18 Q&A 데이터 — Phase 2-D-10.
// 작업지시서 §4 정본 + 갭-3/갭-4 본 채널 검증 사실 영속화.
// 카테고리 = inquiries.category 6값 정합 (billing/analysis/bug/account/feature/etc).

export type FAQCategory =
  | "billing"
  | "analysis"
  | "bug"
  | "account"
  | "feature"
  | "etc";

export interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
}

export const FAQ_CATEGORY_LABELS: Record<FAQCategory, string> = {
  billing: "결제·NAT",
  analysis: "분석 모델",
  bug: "오류·버그",
  account: "계정·로그인",
  feature: "기능 제안",
  etc: "기타",
};

export const FAQ_CATEGORY_ORDER: readonly FAQCategory[] = [
  "billing",
  "analysis",
  "bug",
  "account",
  "feature",
  "etc",
];

export const FAQ_ITEMS: readonly FAQItem[] = [
  // ── billing (결제·NAT) ──────────────────────────────────────
  {
    id: "faq-billing-1",
    category: "billing",
    question: "NAT 1개로 얼마만큼의 작품 분석을 받을 수 있나요?",
    answer:
      "NAT 차감량은 작품 글자 수와 옵션에 따라 다릅니다. 6,000자 이하의 작품은 1 NAT, 6,001자~10,000자는 2 NAT가 차감됩니다. 세계관·인물 설정 분석은 기본 포함되어 추가 NAT 차감 없이 함께 제공됩니다. 플랫폼 최적화(카카오페이지·문피아·네이버시리즈) 분석을 추가하면 +1 NAT가 부과됩니다.",
  },
  {
    id: "faq-billing-2",
    category: "billing",
    question: "NAT는 어떻게 충전하나요?",
    answer:
      "NAT는 결제 페이지에서 충전 가능합니다. 충전 단위·가격 등 자세한 사양은 결제 페이지를 참조해주세요.",
  },
  {
    id: "faq-billing-3",
    category: "billing",
    question: "NAT 환불은 어떻게 받나요?",
    answer:
      "환불 관련 사항은 1:1 문의로 보내주시면 운영팀이 순차 안내드립니다.",
  },

  // ── analysis (분석 모델) ────────────────────────────────────
  {
    id: "faq-analysis-1",
    category: "analysis",
    question: "Novel Agent는 작품의 어떤 부분을 분석하나요?",
    answer:
      "총 6가지 핵심 축으로 분석합니다 — 첫 훅·몰입 / 인물 매력 / 세계관 / 긴장감 / 로맨스·감정선 / 독창성. 각 축별로 강점·약점·개선 방향을 제시하며, 작가가 작품의 흐름을 정량·정성적으로 파악할 수 있도록 구조화된 리포트를 제공합니다.",
  },
  {
    id: "faq-analysis-2",
    category: "analysis",
    question: "분석을 받으려면 최소 몇 자가 필요한가요?",
    answer:
      "최소 500자 이상의 본문이 필요합니다. 500자 미만 시 분석이 진행되지 않으며 안내 메시지가 표시됩니다. 또한 분석은 10화 단위 묶음으로 처리되어, 장편의 경우 회차별 진단도 가능합니다.",
  },
  {
    id: "faq-analysis-3",
    category: "analysis",
    question: "분석 요청 후 결과는 언제 받을 수 있나요?",
    answer:
      "분석 소요 시간은 최소 40초이며, 회차 분석량이 많을수록 길어져 최대 10분까지 소요될 수 있습니다. 분석은 백그라운드로 처리되어 다른 작업을 진행하셔도 되며, 완료 시 사이트에서 결과를 확인하실 수 있습니다.",
  },

  // ── bug (오류·버그) ─────────────────────────────────────────
  {
    id: "faq-bug-1",
    category: "bug",
    question: 'NAT가 충분한데도 "잔액 부족" 안내가 나옵니다.',
    answer:
      "NAT 잔액 확인은 결제 페이지 또는 마이 페이지의 NAT 정보에서 가능합니다. 작품 글자 수·옵션에 따라 필요 NAT 값이 다르므로, 분석 요청 시 표시되는 필요 NAT 값과 보유 NAT를 확인해주세요. 그래도 안내가 지속되면 1:1 문의로 상황을 전달해주시면 빠르게 확인드리겠습니다.",
  },
  {
    id: "faq-bug-2",
    category: "bug",
    question: "분석이 실패했을 때 NAT는 어떻게 처리되나요?",
    answer:
      "분석 실패 시 NAT는 차감되지 않습니다. NAT는 분석이 성공적으로 완료된 경우에만 차감되므로, 실패한 경우 잔액 그대로 안전하게 재시도하실 수 있습니다. 만약 차감이 발생했다고 보이는 경우 1:1 문의로 알려주세요.",
  },
  {
    id: "faq-bug-3",
    category: "bug",
    question: "분석 요청 시 안내 메시지가 떠서 진행이 안 됩니다.",
    answer:
      "분석 요청 시 다음과 같은 안내가 나올 수 있습니다 — 전화번호 인증이 완료되지 않은 경우, 동일 회차의 분석이 이미 진행 중인 경우, 본문 글자 수가 부족한 경우, 기존 분석 결과를 재사용할 수 있는 경우. 각 안내에 따라 조치 후 재시도하시거나, 1:1 문의로 도움을 요청해주세요.",
  },

  // ── account (계정·로그인) ───────────────────────────────────
  {
    id: "faq-account-1",
    category: "account",
    question: "어떻게 로그인하나요? 이메일·비밀번호 로그인은 없나요?",
    answer:
      "Novel Agent는 Google 또는 Naver 소셜 로그인만 지원합니다. 이메일·비밀번호 로그인 방식은 제공하지 않으며, 보안과 사용 편의를 위해 소셜 인증 방식으로 통합 운영하고 있습니다.",
  },
  {
    id: "faq-account-2",
    category: "account",
    question: "첫 로그인 시 약관 동의 화면이 뜨는데, 다시 안 뜨나요?",
    answer:
      "신규 가입 시에만 약관 동의 모달이 표시되며, 동의 후에는 사용자 정보에 기록되어 재로그인 시 다시 표시되지 않습니다. 약관 변경 등 운영 사양 변경 시 별도 안내드립니다.",
  },
  {
    id: "faq-account-3",
    category: "account",
    question: "회원 탈퇴는 어떻게 하나요?",
    answer:
      "회원 탈퇴는 현재 1:1 문의로 요청해주시면 안내드리고 있습니다. UI에서 바로 진행할 수 있는 진입점은 베타 운영 안정화 후 정식 추가 예정입니다.",
  },

  // ── feature (기능 제안·문의) ────────────────────────────────
  {
    id: "faq-feature-1",
    category: "feature",
    question: "새로운 기능을 제안하고 싶습니다.",
    answer:
      "1:1 문의로 자유롭게 의견 보내주세요. 운영팀이 검토 후 답변드리며, 우선순위에 따라 향후 업데이트에 반영합니다.",
  },
  {
    id: "faq-feature-2",
    category: "feature",
    question: "1:1 문의 답변은 언제 받을 수 있나요?",
    answer:
      "운영 시간은 평일 10:00 ~ 18:00이며, 점심시간·공휴일을 제외하고 순차 답변드립니다. 답변이 도착하면 사이트 알림으로 안내드리며, 「내 문의 내역」에서 다시 확인하실 수 있습니다.",
  },
  {
    id: "faq-feature-3",
    category: "feature",
    question: "답변 받은 문의에 추가 질문할 수 있나요?",
    answer:
      "답변 완료된 문의 하단의 「추가 질문」 버튼으로 동일 카테고리의 새 문의를 작성할 수 있습니다. 새 문의는 기존 문의와 독립된 단일 thread로 관리됩니다. 또한 답변이 도움이 되었을 경우 「👍 해결됨」 버튼으로 문의를 종료할 수 있습니다.",
  },

  // ── etc (기타) ──────────────────────────────────────────────
  {
    id: "faq-etc-1",
    category: "etc",
    question: "Novel Agent는 어떤 작가를 위한 서비스인가요?",
    answer:
      "Novel Agent는 한국 웹소설 작가를 위한 AI 기반 작품 성과 분석 SaaS입니다. 카카오페이지·문피아·네이버시리즈 등 주요 웹소설 플랫폼 출간을 준비하거나 연재 중인 작가가 작품의 강점·약점을 정량적으로 진단하고 개선 방향을 모색할 수 있도록 지원합니다.",
  },
  {
    id: "faq-etc-2",
    category: "etc",
    question: "분석 결과는 안전하게 보관되나요?",
    answer:
      "작품 텍스트와 분석 결과는 자체 데이터베이스에 안전하게 저장되며, 외부 서비스로 임의 공유되지 않습니다. 분석 시 사용되는 AI 모델은 사용자 데이터를 학습에 사용하지 않는 정책의 API만 사용합니다.",
  },
  {
    id: "faq-etc-3",
    category: "etc",
    question: "제가 작성한 작품이 다른 AI 학습에 사용되지 않나요?",
    answer:
      "사용자 작품은 분석 목적으로만 사용되며, AI 모델 학습 등 다른 용도로 사용되지 않습니다. 분석에 사용되는 LLM API 제공사 또한 사용자 데이터를 학습에 활용하지 않는 정책을 채택한 곳만 운영에 반영합니다.",
  },
];
