/** Anthropic(등) 재시도 후에도 실패 — NAT는 아직 차감되지 않은 상태에서 던짐 */
export class AnalysisProviderExhaustedError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "NAT는 차감되지 않았습니다. 잠시 후 다시 시도해주세요."
    );
    this.name = "AnalysisProviderExhaustedError";
  }
}
