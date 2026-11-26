import { decode } from "../lib/api";

type HistoryRecord = {
  kind: string;
  actor: string;
  created: string;
  body: string;
};

// Format audit timestamps consistently in the banking workspace's Dubai timezone.
function historyTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  // Read a localized date component without depending on locale punctuation.
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;
}

// Promote status values to event titles and keep supporting explanations below the timestamp.
export function CaseHistoryEntry({ record }: { record: HistoryRecord }) {
  const body = decode(record.body);
  const status = record.kind === "status";
  const title = status
    ? typeof body === "string"
      ? body
      : body.status || body.message || "Status updated"
    : record.kind.replaceAll("_", " ");
  const description = status
    ? typeof body === "string"
      ? ""
      : body.reason || body.description || ""
    : typeof body === "string"
      ? body
      : body.message || "Decision recorded against the current proposal.";

  return (
    <div>
      <span className="timeline-dot" />
      <strong>{title}</strong>
      <small>
        <time dateTime={record.created}>
          {historyTimestamp(record.created)}
        </time>
        {" · "}
        {record.actor}
      </small>
      {description && <p>{description}</p>}
    </div>
  );
}
