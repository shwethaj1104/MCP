import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Info,
  X,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { Dialog } from "./Dialog";
import {
  readToolEvidence,
  toolTitle,
  evidenceLabel,
  evidenceValue,
  unwrapEvidence,
  type EvidenceData,
  type ToolRecord,
  type ToolEvidence,
} from "../lib/tool-evidence";
// Render object facts as semantic key/value pairs and nested evidence as readable sections.
function EvidenceFacts({ data }: { data: EvidenceData }) {
  if (data === null)
    return <p className="tool-empty">No value was returned.</p>;
  if (typeof data !== "object")
    return <p className="evidence-prose">{String(data)}</p>;
  if (Array.isArray(data))
    return data.length ? (
      <div className="evidence-items">
        {data.map((value, index) => (
          <section key={index}>
            <h4>Response {index + 1}</h4>
            <EvidenceFacts data={value} />
          </section>
        ))}
      </div>
    ) : (
      <p className="tool-empty">No items were returned.</p>
    );
  const currency = typeof data.currency === "string" ? data.currency : "AED";
  const simple = Object.entries(data).filter(
    ([, value]) => value === null || typeof value !== "object",
  );
  const nested = Object.entries(data).filter(
    ([, value]) => value !== null && typeof value === "object",
  );
  return (
    <>
      <dl className="evidence-facts">
        {simple.map(([key, value]) => (
          <div
            key={key}
            className={
              typeof value === "string" && value.length > 100
                ? "wide-fact"
                : undefined
            }
          >
            <dt>{evidenceLabel(key)}</dt>
            <dd>{evidenceValue(key, value, currency)}</dd>
          </div>
        ))}
      </dl>
      {nested.map(([key, value]) => (
        <section className="nested-evidence" key={key}>
          <h4>{evidenceLabel(key)}</h4>
          <EvidenceFacts data={value} />
        </section>
      ))}
    </>
  );
}
// Compare candidate transactions using formatted amounts and explicit field headings.
function TransactionMatches({
  data,
  duplicate,
}: {
  data: EvidenceData;
  duplicate: boolean;
}) {
  const object =
    data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(object.possible_duplicates)
      ? object.possible_duplicates
      : [];
  return (
    <>
      <div className="match-summary">
        <strong>
          {rows.length} {rows.length === 1 ? "transaction" : "transactions"}{" "}
          found
        </strong>
        <span>
          {duplicate
            ? "Possible matches for review"
            : "Same-merchant transaction records"}
        </span>
      </div>
      {rows.length ? (
        <div className="evidence-table-scroll">
          <table>
            <caption className="visually-hidden">
              {duplicate
                ? "Possible duplicate transactions"
                : "Related transaction details"}
            </caption>
            <thead>
              <tr>
                {[
                  "Reference",
                  "Merchant",
                  "Amount",
                  "Date",
                  "Reversed",
                  "Account",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                if (!row || typeof row !== "object" || Array.isArray(row))
                  return (
                    <tr key={index}>
                      <td colSpan={6}>{String(row)}</td>
                    </tr>
                  );
                return (
                  <tr key={index}>
                    {[
                      "id",
                      "merchant",
                      "amount",
                      "date",
                      "reversed",
                      "account_id",
                    ].map((key) => (
                      <td key={key}>
                        {evidenceValue(
                          key,
                          row[key] ?? null,
                          typeof row.currency === "string"
                            ? row.currency
                            : "AED",
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tool-empty">
          {duplicate
            ? "No possible duplicates were returned by this check."
            : "No related transactions were returned."}
        </p>
      )}
      {typeof object.note === "string" && (
        <div className="evidence-note">
          <Info size={15} />
          <p>{object.note}</p>
        </div>
      )}
    </>
  );
}
// Use a presentation suited to each tool rather than exposing its JSON transport wrapper.
function ToolResponse({ run }: { run: ToolEvidence }) {
  const data = run.data;
  if (data && typeof data === "object" && !Array.isArray(data) && data.error)
    return (
      <div className="evidence-note">
        <AlertCircle size={16} />
        <p>{String(data.error)}</p>
      </div>
    );
  if (
    run.name === "find_possible_duplicates" ||
    run.name === "get_related_transactions"
  )
    return (
      <TransactionMatches
        data={data}
        duplicate={run.name === "find_possible_duplicates"}
      />
    );
  if (
    run.name === "get_case_evidence" &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  )
    return (
      <>
        <EvidenceFacts data={{ reason: data.reason ?? null }} />
        <section className="customer-evidence">
          <h4>Customer statement</h4>
          <p>
            {typeof data.statement === "string"
              ? data.statement
              : "Not provided"}
          </p>
        </section>
        <section className="customer-evidence">
          <h4>Supporting evidence and responses</h4>
          {Array.isArray(data.responses) && data.responses.length ? (
            data.responses.map((response, index) => (
              <div className="customer-response" key={index}>
                <span>Response {index + 1}</span>
                <EvidenceFacts data={unwrapEvidence(response)} />
              </div>
            ))
          ) : (
            <p className="tool-empty">
              No additional evidence or responses were supplied.
            </p>
          )}
        </section>
      </>
    );
  return <EvidenceFacts data={data} />;
}
// Preserve expansion state when live processing appends new tool runs to the popup.
function ToolRun({
  run,
  number,
  initiallyOpen,
}: {
  run: ToolEvidence;
  number: number;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const error =
    run.data &&
    typeof run.data === "object" &&
    !Array.isArray(run.data) &&
    Boolean(run.data.error);
  return (
    <details
      className="evidence-run"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="evidence-run-icon">
          {error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
        </span>
        <span className="evidence-run-name">
          <strong>{toolTitle(run.name)}</strong>
          <small>
            Run {String(number).padStart(2, "0")} ·{" "}
            {new Date(run.created).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </small>
        </span>
        <span className="evidence-run-tag">
          {error ? "Needs attention" : "Response received"}
        </span>
        <ChevronDown size={18} className="evidence-chevron" />
      </summary>
      <div className="evidence-run-content">
        <ToolResponse run={run} />
      </div>
    </details>
  );
}
// Display role-scoped banking evidence in a full-width, human-readable modal workspace.
export function ToolActivityDialog({
  caseId,
  records,
  onClose,
}: {
  caseId: string;
  records: ToolRecord[];
  onClose: () => void;
}) {
  const runs = records.map(readToolEvidence).reverse();
  return (
    <Dialog onClose={onClose}>
      <section
        className="modal tool-activity-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-activity-title"
      >
        <button
          className="close"
          onClick={onClose}
          aria-label="Close banking tool activity"
        >
          <X size={21} />
        </button>
        <div className="tool-dialog-heading">
          <span className="tool-dialog-icon">
            <Activity size={25} />
          </span>
          <div>
            <span className="tool-dialog-kicker">
              BANKING EVIDENCE / {caseId}
            </span>
            <h2 id="tool-activity-title">Banking tool activity</h2>
            <p>
              Facts retrieved for this investigation, organized for human
              review.
            </p>
          </div>
        </div>
        <div className="tool-dialog-summary">
          <span>
            <CheckCircle2 size={15} />
            {runs.length} tool {runs.length === 1 ? "run" : "runs"}
          </span>
          <span>
            <Activity size={15} />
            {new Set(runs.map((run) => run.name)).size} distinct checks
          </span>
          <span>
            <Clock3 size={15} />
            Most recent first
          </span>
        </div>
        <div className="tool-activity-body">
          {runs.length ? (
            runs.map((run, index) => (
              <ToolRun
                key={run.id}
                run={run}
                number={runs.length - index}
                initiallyOpen={index === 0}
              />
            ))
          ) : (
            <div className="empty">
              <Activity size={30} />
              <h3>No tool responses yet.</h3>
              <p>
                Evidence will appear here when the investigation calls the
                banking tools.
              </p>
            </div>
          )}
        </div>
        <div className="tool-dialog-footer">
          <Info size={14} />
          <span>
            Tool responses are evidence. The bank reviewer determines the
            outcome.
          </span>
        </div>
      </section>
    </Dialog>
  );
}
