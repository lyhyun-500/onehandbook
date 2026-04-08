export type TrendsSearchHit = {
  document: string;
  metadata: Record<string, unknown>;
  distance: number | null;
};

export type TrendsSearchExecutionResult = {
  hits: TrendsSearchHit[];
  usedGenreFilter: boolean;
  unfilteredFallback: boolean;
};
