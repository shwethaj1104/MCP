import {
  Check,
  CircleDashed,
  UserRound,
  ScanLine,
  ArrowUpRight,
} from "lucide-react";
// Distinguish workflow stages with explicit labels and a quiet processing signal.
export function Badge({
  status,
  paused = false,
}: {
  status: string;
  paused?: boolean;
}) {
  const Icon =
    status === "Closed"
      ? Check
      : status === "Under Bank Review"
        ? ScanLine
        : status === "Awaiting Customer Consent"
          ? UserRound
          : status === "Resolution Pending"
            ? ArrowUpRight
            : CircleDashed;
  return (
    <span className={"badge " + (status === "Closed" ? "complete" : "")}>
      {status.startsWith("AI Review") || status === "AI Setup Required" ? (
        <span
          aria-hidden="true"
          className={
            "status-signal" +
            (status === "AI Review Failed"
              ? " is-failed"
              : status === "AI Review Queued" || status === "AI Setup Required"
                ? " is-queued"
                : paused || status === "AI Review Paused"
                  ? " is-paused"
                  : " is-active")
          }
        />
      ) : (
        <Icon size={12} />
      )}
      {status}
    </span>
  );
}
