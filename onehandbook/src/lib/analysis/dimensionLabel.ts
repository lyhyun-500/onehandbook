/**
 * 과거 분석 JSON에 영어 snake_case 키가 남아 있을 때 화면용 한글로 바꿉니다.
 * 신규 분석은 프롬프트에서 한글 키만 쓰도록 유도합니다.
 */
const EN_TO_KO: Record<string, string> = {
  plot_engagement: "플롯 몰입도",
  writing_quality: "문장·작법",
  character_appeal: "인물 매력",
  romance_potential: "로맨스·감정선",
  premise_originality: "설정·소재 독창성",
  commercial_viability: "상업성·흥행력",
  immersion: "몰입도",
  pacing: "전개·호흡",
  hook_strength: "첫 훅·몰입",
  worldbuilding: "세계관",
  character_consistency: "캐릭터 일관성",
  world_setting_accuracy: "세계관 고증",
  character_setting_consistency: "캐릭터 일관성",
  relationship_usage: "인물 관계 활용도",
  relationship_utilization: "인물 관계 활용도",
  dialogue_quality: "대사·대화",
  tension: "긴장감",
  originality: "독창성",
  readability: "가독성",
};

export function formatDimensionLabel(key: string): string {
  const k = key.trim();
  if (/[가-힣]/.test(k)) {
    return k;
  }
  const lower = k.toLowerCase();
  if (EN_TO_KO[lower]) {
    return EN_TO_KO[lower];
  }
  return k.replace(/_/g, " ");
}
