export type CaseStatus = {
  status: string;
  display_status?: string;
  processing_state?: string | null;
  error?: string | null;
};
export const workflowStages = [
  "Submitted",
  "AI Review in Progress",
  "Under Bank Review",
  "Awaiting Customer Consent",
  "Resolution Pending",
  "Closed",
];
// Map analysis sub-states into the same workflow slot rather than inventing extra steps.
export function workflowStage(status: string) {
  return [
    "AI Review Failed",
    "AI Review Queued",
    "AI Setup Required",
    "AI Review Paused",
  ].includes(status)
    ? "AI Review in Progress"
    : status;
}
// Prefer authoritative runtime status while remaining accurate against an older backend response.
export function caseDisplayStatus(item: CaseStatus): string {
  if (item.display_status) return item.display_status;
  const analysis = [
    "Submitted",
    "AI Review in Progress",
    "AI Review Failed",
    "AI Review Queued",
  ].includes(item.status);
  if (analysis && (item.error || item.processing_state === "failed"))
    return "AI Review Failed";
  if (analysis && item.processing_state === "awaiting_configuration")
    return "AI Setup Required";
  if (analysis && item.processing_state === "queued") return "AI Review Queued";
  if (analysis && item.processing_state === "running")
    return "AI Review in Progress";
  if (
    item.status === "AI Review in Progress" &&
    item.processing_state === "done"
  )
    return "AI Review Paused";
  return item.status;
}
