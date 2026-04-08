export function isMissingHolisticChunkResultsTableError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    msg.includes("holistic_chunk_results") && msg.includes("does not exist")
  );
}
