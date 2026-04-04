/**
 * 작품 메타 `works.genre` 문자열에 맞춰 장르별 평가 축 블록을 만든다.
 * 여러 키워드가 겹치면(예: 로맨스판타지) 해당 블록을 모두 붙인다.
 */
export function buildGenreEvalAxesSection(workGenreRaw: string): string {
  const g = workGenreRaw.trim() || "(장르 미입력)";
  const axisBlocks = resolveGenreAxisBlocks(g);

  return [
    "## 장르별 평가 축",
    "",
    `작품 설정 장르: **${g}**`,
    "",
    "아래 항목들은 `dimensions`에 **아래 한글 이름을 JSON 키로 그대로** 두고 각각 score·comment를 작성할 것 (영어 키 금지):",
    "",
    axisBlocks,
    "",
  ].join("\n");
}

function resolveGenreAxisBlocks(genre: string): string {
  const blocks: string[] = [];

  if (/법정|정치/.test(genre)) {
    blocks.push(
      block(
        "법정·정치",
        [
          "전문성",
          "리얼리티",
          "사이다 구조",
        ]
      )
    );
  }
  if (/무협/.test(genre)) {
    blocks.push(
      block("무협", ["무공 묘사", "강호 리얼리티", "성장 서사"])
    );
  }
  if (/판타지|이세계/.test(genre)) {
    blocks.push(
      block("판타지", [
        "세계관 독창성",
        "마법·능력 시스템",
        "몰입도",
      ])
    );
  }
  if (/로맨스|연애|멜로|BL|GL/.test(genre)) {
    blocks.push(
      block("로맨스", ["설렘 포인트", "감정선", "남주/여주 매력도"])
    );
  }
  if (/현대물|오피스/.test(genre) || /^현대/.test(genre.trim())) {
    blocks.push(
      block("현대물", ["공감도", "직업 고증", "트렌드 적합성"])
    );
  }

  if (blocks.length === 0) {
    return [
      "### 일반",
      "",
      "- 몰입도",
      "- 인물·관계 매력",
      "- 전개·클리프·회차 단위 만족도",
      "",
      "장르 메타가 세분되지 않은 경우, 위 일반 축으로 dimensions를 구성해도 된다.",
    ].join("\n");
  }

  return blocks.join("\n\n");
}

function block(title: string, items: string[]): string {
  const bullets = items.map((s) => `- ${s}`).join("\n");
  return [`### ${title}`, "", bullets].join("\n");
}
