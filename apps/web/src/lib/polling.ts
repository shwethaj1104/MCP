export type ProcessingCase = {
  id: string;
  version?: number;
  status: string;
  error?: string | null;
  processing_state?: string | null;
};
const activeStatuses = new Set([
  "Submitted",
  "AI Review in Progress",
  "Resolution Pending",
]);
// Poll only an active background job, never a failed case or a human-review checkpoint.
export function isCaseProcessing(item: ProcessingCase | undefined) {
  if (!item || item.error) return false;
  if ("processing_state" in item)
    return (
      item.processing_state === "queued" || item.processing_state === "running"
    );
  return activeStatuses.has(item.status);
}
// Bound one case/version to five minutes of status checks before requiring an explicit refresh.
export function processingInterval(
  items: ProcessingCase[],
  started: Map<string, number>,
  now = Date.now(),
): number | false {
  let active = false;
  for (const item of items) {
    const key = `${item.id}:${item.version ?? 0}`;
    if (!isCaseProcessing(item)) {
      started.delete(key);
      continue;
    }
    if (!started.has(key)) started.set(key, now);
    if (now - (started.get(key) ?? now) < 300000) active = true;
  }
  return active ? 2500 : false;
}
