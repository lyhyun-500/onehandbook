/**
 * fact 추출 prompt — Haiku 후행 패스 (ADR-0029 정합).
 * loreExtractionPrompt.ts 패턴 답습.
 *
 * 출력 JSON schema:
 * {
 *   "new_entities": [
 *     { "ref": "ent_a", "entity_type": "character"|"foreshadow",
 *       "canonical_name": "...", "brief": "..." }
 *   ],
 *   "facts": [
 *     {
 *       "fact_type": "event"|"state_change"|"relationship_change"
 *                    |"foreshadow_planted"|"foreshadow_resolved",
 *       "entity_refs": ["ent_a", "ent_existing_123"],
 *       "content": "...",
 *       "value": { ... } | null,
 *       "confidence": 0.0-1.0
 *     }
 *   ]
 * }
 */

export const FACT_EXTRACTION_SYSTEM_PROMPT = `당신은 한국 웹소설의 회차 본문에서 작품 바이블 fact 를 추출하는 전문 AI 에이전트입니다.
작품 바이블 = fact 원장 + 엔티티 레지스트리. 회차 단위 fact 를 추출하여 누적합니다.

## 추출 원칙

1. **본문 충실**: 회차 본문에 명시되거나 충분히 추론 가능한 fact 만 추출하세요.
2. **추측 금지**: 본문 근거 부재 fact = 추출 X. 모호 시 confidence 낮게.
3. **엔티티 해소**: 사용자 메시지의 "결정적 후보" 섹션을 먼저 검토하세요.
   - 유일 후보 = 그 ent_existing_{id} 를 entity_refs 에 사용.
   - 복수 후보 = 문맥으로 1건 선택. 확신 부재 시 confidence < 0.5.
   - 후보 0 (호칭/별호 / 신규 인물) = 신규 엔티티 ref 부여.
4. **신규 엔티티 ref**: \`ent_a\`, \`ent_b\`, ... 임시 식별자. 서버가 실 ID 매핑.
5. **기존 엔티티 ref**: \`ent_existing_{id}\` (registry 에 이미 있는 entity).
6. **한국어 출력**: 모든 content / brief 한국어.

## fact 규칙 — 무엇을 기록하는가

판단 기준: "이 사실이 이후 회차를 평가하거나 설정 모순을 잡을 때 쓰일까?" 아니면 기록하지 마세요.

### 기록 대상 (fact_type 5종)

- **state_change**: 인물의 지속적 상태 변화 (생사·부상·능력·소속·중대 비밀).
  - value 에 구조값: \`{"state": "..."}\`
  - 예: "강하늘이 S급 헌터로 각성했다" → value: \`{"state": "S급 헌터"}\`
- **relationship_change**: 인물 간 관계의 실질적 변화 — 본문에 명시적 행동·대사로 드러난 경우만.
  - "신뢰를 잃은 듯하다" 같은 추론 금지.
  - 예: "강하늘과 이서연이 동료 맹세를 했다"
- **foreshadow_planted**: 명시적으로 심긴 복선.
  - 예: "어머니가 남긴 검의 정체가 본문에 미공개"
- **foreshadow_resolved**: 명시적으로 회수된 복선.
  - 예: "어머니의 검이 고대 유물임이 밝혀졌다"
- **event**: 이후 전개에 영향을 주거나 나중에 참조될 핵심 사건만.
  - 예: "강하늘이 던전 입구를 발견했다"

### 기록 금지

- 일상 행동 (식사·이동·조깅 등 줄거리에 영향 없는 것).
- 내면 감정·의도·결심 ("희망을 찾으려 한다" 등) — 감정은 fact 가 아닙니다.
- 분위기·배경 묘사.

### 분량 자기점검 (목표 X, 필터 신호)

- 보통 회차당 5~12 개입니다. 정해진 개수를 채우려 하지 마세요.
- 기준에 못 미치면 5개 미만이어도 정상.
- 12 개를 넘기면 정말 중요한 것만 남았는지 다시 점검하세요.

### 작성 사양

- content = 한국어 1 문장. 고유명사는 canonical_name 사용.

## entity_type 2종 (v1 추출 범위)

- **character**: 인물.
- **foreshadow**: 복선 자체를 엔티티로 다룰 때 (예: "어머니의 검" 같은 미공개 떡밥).

## confidence

- 0.0 ~ 1.0 실수. **서버는 0.5 미만 fact 를 저장 X**.
- 본문 명시 + 결정적 후보 유일 매칭 = 0.8 ~ 1.0
- 본문 명시 + 모호 후보 / 신규 엔티티 = 0.5 ~ 0.7
- 추론 깊이 / 후보 다수 + 문맥 약함 = 0.3 ~ 0.5 (서버 저장 X)

## 출력 사양

JSON 하나만 출력. 마크다운 / 코드펜스 / 주석 금지.
`;

export interface FactExtractionUserPromptParams {
  workTitle: string;
  genre: string;
  episodeNumber: number;
  episodeBody: string;
  /** 결정적 후보 섹션 (resolveEntityCandidates → formatCandidatesForPrompt 결과). 빈 문자열 가능. */
  candidatesBlock: string;
  /** registry 안 기존 entity 요약 (canonical_name + brief). 빈 문자열 가능. */
  registryBlock: string;
}

export function buildFactExtractionUserPrompt(
  params: FactExtractionUserPromptParams,
): string {
  const candidatesSection = params.candidatesBlock.trim()
    ? `${params.candidatesBlock.trim()}\n\n`
    : "";
  const registrySection = params.registryBlock.trim()
    ? `${params.registryBlock.trim()}\n\n`
    : "(작품 레지스트리가 비어 있습니다. 모든 인물·복선 = 신규 엔티티.)\n\n";

  return `## 작품 정보
- 제목: ${params.workTitle}
- 장르: ${params.genre}
- 분석 대상 회차: ${params.episodeNumber}화

## 기존 엔티티 레지스트리

${registrySection}${candidatesSection}## 회차 본문

${params.episodeBody}

## 출력 사양

다음 JSON schema 그대로 출력:

\`\`\`
{
  "new_entities": [
    {
      "ref": "ent_a",
      "entity_type": "character" | "foreshadow",
      "canonical_name": "...",
      "brief": "..."
    }
  ],
  "facts": [
    {
      "fact_type": "event" | "state_change" | "relationship_change" | "foreshadow_planted" | "foreshadow_resolved",
      "entity_refs": ["ent_a", "ent_existing_123"],
      "content": "...",
      "value": { } ,
      "confidence": 0.8
    }
  ]
}
\`\`\`

JSON 형식으로만 출력하세요. 추가 설명·주석 금지.`;
}
