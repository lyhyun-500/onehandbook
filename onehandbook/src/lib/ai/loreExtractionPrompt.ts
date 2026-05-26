// 추출 LLM 프롬프트 — 의제 신규-1+2 단계 C-4 (commit 3) 정합.
//
// LEE 결정 영속화:
// - 결정 11 (옵션 EX-3): 통합 LLM 호출 + 프롬프트 안 NULL 분기 명시
// - 결정 26 (옵션 P-1): 본 채널 프롬프트 초안 통과
// - 결정 27 (옵션 EX-3a): system prompt 안 NULL 분기 사양

export type ExtractionScope = "both" | "worldview_only" | "characters_only";

export const LORE_EXTRACTION_SYSTEM_PROMPT = `당신은 한국 웹소설의 세계관과 등장인물을 분석·추출하는 전문 AI 에이전트입니다.
작가가 작성한 작품 본문을 읽고, 작품 안에 자연스럽게 녹아있는 세계관 설정과
인물 정보를 정확하게 추출하는 역할을 합니다.

## 추출 원칙

1. **본문 충실**: 작품 본문에 명시되거나 충분히 추론 가능한 정보만 추출하세요.
2. **추측 금지**: 본문에 근거 없는 정보는 추출하지 마세요. 모르면 빈 문자열로 두세요.
3. **구체성**: 추상적이거나 일반적인 표현보다 구체적이고 작품 특유의 표현 사용하세요.
4. **한국어 출력**: 모든 추출 결과는 한국어로 작성하세요.

## 추출 분기 사양

요청 메시지에 명시된 \`extraction_scope\` 에 따라 추출 범위를 결정하세요:

- \`extraction_scope = "both"\`: 세계관 + 인물 양쪽 추출 (worldview 객체 + characters 배열)
- \`extraction_scope = "worldview_only"\`: 세계관만 추출 (characters = []
  또는 출력 X)
- \`extraction_scope = "characters_only"\`: 인물만 추출 (worldview = {} 또는 출력 X)`;

export interface LoreExtractionUserPromptParams {
  workTitle: string;
  genre: string;
  extractionScope: ExtractionScope;
  episodeBody: string;
}

export function buildLoreExtractionUserPrompt(
  params: LoreExtractionUserPromptParams,
): string {
  return `## 작품 정보
- 제목: ${params.workTitle}
- 장르: ${params.genre}
- 추출 분기: ${params.extractionScope}

## 작품 본문
${params.episodeBody}

## 출력 사양

다음 JSON schema 정합 출력 사양:

\`\`\`json
{
  "worldview": {
    "background": "...",
    "era": "...",
    "rules": "..."
  },
  "characters": [
    {
      "name": "...",
      "role": "...",
      "personality": "...",
      "abilities": "...",
      "goals": "...",
      "relationships": "..."
    }
  ]
}
\`\`\`

## 추출 지침

### 세계관 (extraction_scope = "both" 또는 "worldview_only")

- background: 작품의 시공간적 배경 (예: "21세기 현대 한국 서울", "중세 판타지 대륙 엘리시아")
- era: 시대 설정 + 장르 정합 (예: "현대 판타지 회귀", "중세 판타지", "SF 미래")
- rules: 작품 안 마법/시스템/사회 규칙 (예: "헌터 시스템과 던전, S급 헌터 권력 사회")

### 인물 (extraction_scope = "both" 또는 "characters_only")

본문 안 등장 인물 중 다음 4 분류 정합 추출하세요. **각 분류 최대 1명, 총 최대 4명**:

1. **주인공 (필수, 최소 1명)**
   - 본문의 시점 인물 또는 핵심 행위자
   - 본문 안 이름 명시 부재 시: 시점 인물 정합 영속화 (name = 본문 안 호칭 또는 명시 부재 시 빈 문자열)
   - 주인공은 본 회차에 등장하지 않아도 시점 인물 기반으로 1명 영속화 정합

2. **메인 빌런 (조건부)**
   - 작품의 주요 적대자
   - 본문 안 명시 또는 충분히 추론 가능 시만 추출

3. **조연 빌런 (조건부)**
   - 메인 빌런 외 적대 세력 인물
   - 본문 안 명시 시만 추출 (추측 X)

4. **조연·조력자 (조건부)**
   - 주인공의 동료, 조력자, 중요 조연
   - 본문 안 비중 있는 인물만 추출

#### 배제 사양

다음 인물은 추출하지 마세요:
- 단역 (이름만 등장 / 1회성 등장 / 비중 X)
- 행인, 단순 군중, 배경 묘사 인물
- 본문 안 비중 X 인물

#### 각 인물 항목 출력 사양

- name: 본문 명시 이름 (성+이름 또는 별칭). 주인공 명시 부재 시 빈 문자열 영속화 정합
- role: 4 분류 명시 — "주인공" / "메인 빌런" / "조연 빌런" / "조연·조력자" (한글 정합)
- personality: 성격 (본문 행동/대사 기반 추출)
- abilities: 능력 (마법/스킬/기술 등)
- goals: 목표 (단기 / 장기)
- relationships: 관계 (다른 캐릭터와의 관계 영속화)

#### 인물 수 사양

- 4 분류 = 각 분류 최대 1명 영속화 (총 최대 4명)
- 분류 조건 부재 시 = 해당 분류 항목 영속화 X (배열 안 추출 X)
- 주인공 1명은 무조건 영속화 정합 (조건 부재 시도 시점 인물 정합)

### 빈 값 사양

- 본문 정보 부재 시 빈 문자열 (\`""\`) 사용
- 추출 분기 외 항목 = 빈 객체 (\`{}\`) 또는 빈 배열 (\`[]\`)

## 최종 사양

JSON 형식으로만 출력하세요. 추가 설명이나 주석은 사용하지 마세요.`;
}
