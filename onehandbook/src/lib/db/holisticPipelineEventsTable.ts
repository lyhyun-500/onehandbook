export function isMissingHolisticPipelineEventsTableError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    (msg.includes("holistic_pipeline_events") && msg.includes("does not exist"))
  );
}
