export type EvidenceData =
  | null
  | string
  | number
  | boolean
  | EvidenceData[]
  | { [key: string]: EvidenceData };
export type ToolRecord = { id: number; created: string; body: string };
export type ToolEvidence = {
  id: number;
  created: string;
  name: string;
  data: EvidenceData;
};
const names: Record<string, string> = {
  get_transaction_details: "Transaction details",
  get_related_transactions: "Related transactions",
  find_possible_duplicates: "Possible duplicate charges",
  get_existing_reversals: "Reversal check",
  get_dispute_policy: "Dispute policy",
  get_case_evidence: "Customer evidence",
};
const labels: Record<string, string> = {
  id: "Transaction reference",
  transaction_id: "Transaction reference",
  account_id: "Account",
  merchant: "Merchant",
  amount: "Amount",
  currency: "Currency",
  date: "Transaction date",
  reversed: "Already reversed",
  reference: "Policy reference",
  reason: "Dispute reason",
  statement: "Customer statement",
  policy: "Policy guidance",
  note: "Important context",
  message: "Customer response",
  action: "Response type",
  proposal_version: "Proposal version",
};
// Convert technical field names into readable labels while preserving unknown future fields.
export function evidenceLabel(key: string) {
  return (
    labels[key] ||
    key.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase())
  );
}
// Identify evidence checks by their task rather than their implementation function name.
export function toolTitle(name: string) {
  return names[name] || evidenceLabel(name);
}
// Decode the nested MCP text envelope without showing escaped JSON or transport metadata.
export function unwrapEvidence(value: unknown, depth = 0): EvidenceData {
  if (depth > 8)
    return typeof value === "string" ? value : "Response nesting limit reached";
  if (typeof value === "string") {
    if (!["[", "{", '"'].includes(value.trimStart()[0])) return value;
    try {
      return unwrapEvidence(JSON.parse(value), depth + 1);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      value.every(
        (part) => part && typeof part === "object" && part.type === "text",
      )
    ) {
      const parts = value.map((part) => unwrapEvidence(part.text, depth + 1));
      return parts.length === 1 ? parts[0] : parts;
    }
    return value.map((part) => unwrapEvidence(part, depth + 1));
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        unwrapEvidence(item, depth + 1),
      ]),
    );
  return value === undefined ? null : (value as EvidenceData);
}
// Parse one audited tool run and retain a safe human-readable fallback for malformed responses.
export function readToolEvidence(record: ToolRecord): ToolEvidence {
  try {
    const envelope = JSON.parse(record.body);
    return {
      id: record.id,
      created: record.created,
      name: typeof envelope.name === "string" ? envelope.name : "Tool response",
      data: unwrapEvidence(envelope.result),
    };
  } catch {
    return {
      id: record.id,
      created: record.created,
      name: "Tool response",
      data: "This response could not be decoded. The original audit record has been preserved.",
    };
  }
}
// Format amounts, dates and flags according to the banking tool contract.
export function evidenceValue(
  key: string,
  value: EvidenceData,
  currency = "AED",
): string {
  if (value === null || value === "") return "Not provided";
  if (key === "reversed")
    return value === true || value === 1
      ? "Yes"
      : value === false || value === 0
        ? "No"
        : String(value);
  if (key === "amount" && typeof value === "number") {
    try {
      return new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency,
      }).format(value / 100);
    } catch {
      return `${(value / 100).toFixed(2)} ${currency}`;
    }
  }
  if (
    key === "date" &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const date = new Date(value + "T12:00:00");
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  }
  if (key === "action" && typeof value === "string")
    return (
      (
        {
          provide_information: "Additional information supplied",
          disagree: "Customer disagreed",
          accept: "Customer accepted",
        } as Record<string, string>
      )[value] || evidenceLabel(value)
    );
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
