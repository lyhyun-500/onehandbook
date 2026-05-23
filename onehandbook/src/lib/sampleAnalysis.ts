/**
 * 신규 작가 온보딩 (05A 풀스크린) 임베드용 샘플 분석 데이터.
 *
 * LEE 결정 (단계 2): 고정 샘플, API 호출 0, 코드 하드코딩.
 * 시안 design_novel/novel-agent/data.jsx 의 ANALYSIS_DIMENSIONS + MOCK_WORKS[0]
 * + MOCK_EPISODES + MOCK_EPISODE_REVISIONS 포팅.
 */

export interface SampleDimension {
  key: string;
  label: string;
  score: number;
  comment: string;
}

export interface SampleAnalyzedEpisode {
  num: number;
  title: string;
  chars: number;
  score: number;
  updatedAt: string;
}

export interface SampleEpisodeRevision {
  id: string;
  label: string;
  overall: number;
  runAt: string;
  note: string;
  current: boolean;
  deltas: Record<string, number> | null;
}

export const SAMPLE_WORK = {
  title: "황실의 그림자, 검은 장미",
  genre: "로맨스 판타지",
  totalEpisodes: 47,
  episodeNum: 46,
  episodeTitle: "황비의 마지막 카드",
  overallScore: 84,
  percentile: "상위 12%",
  agentNote:
    "도입부의 회상 시퀀스가 강했습니다. 다만 중반 갈등이 직선적으로 해결되어 다음 회차 후킹이 약합니다.",
  analyzedAt: "2026-05-04 18:22",
  natCost: 2,
  charCount: 4520,
};

export const SAMPLE_DIMENSIONS: SampleDimension[] = [
  {
    key: "hook",
    label: "도입 후킹",
    score: 89,
    comment:
      "1인칭 회상으로 시작해 독자의 호기심을 빠르게 잡았습니다. 다만 회상 길이가 길어 본 장면 진입이 늦습니다.",
  },
  {
    key: "character",
    label: "캐릭터 매력",
    score: 86,
    comment:
      "주인공의 내적 갈등이 명확합니다. 이현의 등장에서 한 박자 더 긴 시선 묘사가 있으면 로맨스 라인이 살아납니다.",
  },
  {
    key: "world",
    label: "세계관 밀도",
    score: 82,
    comment:
      "황실 정치 구조는 잘 잡혔습니다. 북부 자치권 관련 정보가 대사로만 전달되어 시각적 디테일이 부족합니다.",
  },
  {
    key: "tension",
    label: "긴장감·전개",
    score: 88,
    comment:
      "장 후반 떡밥 회수가 깔끔합니다. 중반 호흡이 약간 평탄하니 이현 등장 직후 작은 갈등이 있으면 좋겠습니다.",
  },
  {
    key: "emotion",
    label: "감정선",
    score: 79,
    comment:
      "주인공의 분노는 명확하지만 서글픔 레이어가 약합니다. 유모와의 짧은 회상으로 감정 두께를 더해보세요.",
  },
  {
    key: "originality",
    label: "독창성",
    score: 81,
    comment:
      "회귀+황실 클리셰지만 '북부 자치권'이라는 정치 축이 신선합니다. 이 축을 더 일찍 노출시키면 차별화됩니다.",
  },
];

export const SAMPLE_ANALYZED_EPISODES: SampleAnalyzedEpisode[] = [
  { num: 46, title: "황비의 마지막 카드", chars: 4520, score: 87, updatedAt: "어제" },
  { num: 45, title: "검은 장미의 정원", chars: 4310, score: 82, updatedAt: "5월 3일" },
  { num: 44, title: "심야의 밀담", chars: 4680, score: 89, updatedAt: "5월 1일" },
  { num: 43, title: "두 개의 약속", chars: 4090, score: 78, updatedAt: "4월 29일" },
  { num: 42, title: "왕의 침묵", chars: 4400, score: 81, updatedAt: "4월 27일" },
  { num: 41, title: "그림자 속의 진실", chars: 4250, score: 84, updatedAt: "4월 25일" },
  { num: 40, title: "역린(逆鱗)", chars: 4530, score: 92, updatedAt: "4월 23일" },
  { num: 39, title: "독배의 의식", chars: 4170, score: 76, updatedAt: "4월 21일" },
];

export const SAMPLE_REVISIONS: SampleEpisodeRevision[] = [
  {
    id: "r3",
    label: "v3",
    overall: 84,
    runAt: "2026-05-04 18:22",
    note: "현재 보기",
    current: true,
    deltas: {
      hook: 2,
      character: 1,
      world: 0,
      tension: 3,
      emotion: 1,
      originality: 0,
    },
  },
  {
    id: "r2",
    label: "v2",
    overall: 78,
    runAt: "2026-05-02 11:08",
    note: "퇴고 1차 반영",
    current: false,
    deltas: {
      hook: 4,
      character: -1,
      world: 2,
      tension: 1,
      emotion: 0,
      originality: 2,
    },
  },
  {
    id: "r1",
    label: "v1",
    overall: 72,
    runAt: "2026-04-30 09:41",
    note: "초고 분석",
    current: false,
    deltas: null,
  },
];

export const SAMPLE_IMPROVEMENT_POINTS = [
  "회상 시퀀스를 도입부 1/3 안에 압축. 본 장면 진입을 더 빨리 (회상이 길수록 이탈률 상승).",
  "이현 등장 직후 작은 갈등 한 컷 — 중반 호흡 평탄 보완 + 로맨스 라인 강화.",
  "유모와 주인공의 짧은 회상으로 감정 두께 추가. 분노 외 서글픔 레이어가 약함.",
];
