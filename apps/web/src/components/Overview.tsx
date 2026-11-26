import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ScanLine,
  Layers,
  Clock3,
  CheckCircle2,
  FileText,
  Sparkles,
  ShieldCheck,
  UserRound,
  Flag,
} from "lucide-react";
import { workflowStage, caseDisplayStatus } from "../lib/case-status";
type CaseRow = {
  id: string;
  status: string;
  transaction_id: string;
  created: string;
  error?: string | null;
  display_status?: string;
  processing_state?: string | null;
};
type TransactionRow = { id: string; amount: number };
const statuses = [
  "Submitted",
  "AI Review in Progress",
  "Under Bank Review",
  "Awaiting Customer Consent",
  "Resolution Pending",
  "Closed",
];
// Animate a changed numerical metric once while respecting reduced-motion preferences.
function Count({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    // Ease the visible counter towards the latest application value.
    function tick(time: number) {
      const progress = Math.min((time - start) / 650, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      {(typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? value
        : display
      )
        .toString()
        .padStart(2, "0")}
    </>
  );
}
// Present real portfolio metrics, actionable review workload, and case distribution.
export function Overview({
  rows,
  onFilter,
  activeFilter = "All cases",
  reviewer,
}: {
  rows: CaseRow[];
  transactions: TransactionRow[];
  onFilter: (status: string) => void;
  reviewer: boolean;
  activeFilter?: string;
}) {
  const total = rows.length,
    review = rows.filter((c) => c.status === "Under Bank Review").length,
    closed = rows.filter((c) => c.status === "Closed").length,
    customer = rows.filter(
      (c) => c.status === "Awaiting Customer Consent",
    ).length;
  const failed = rows.filter(
    (c) => caseDisplayStatus(c) === "AI Review Failed",
  ).length;
  return (
    <div className="overview-composition">
      <section className="metrics" aria-label="Dispute summary">
        {[
          {
            label: "Total disputes",
            value: total,
            icon: Layers,
            note: "Cases in your workspace",
            tag: "ALL TIME",
          },
          {
            label: reviewer ? "Bank review" : "With the bank",
            value: review,
            icon: ScanLine,
            note: "Waiting for a bank decision",
            tag: "ACTION REQUIRED",
          },
          {
            label: "With the customer",
            value: customer,
            icon: Clock3,
            note: "Consent or more information",
            tag: "AWAITING RESPONSE",
          },
          {
            label: "Resolved disputes",
            value: closed,
            icon: CheckCircle2,
            note: `${total ? Math.round((closed / total) * 100) : 0}% of all submitted cases`,
            tag: "COMPLETED",
          },
        ].map((m, i) => (
          <button
            className={
              "metric metric-" +
              i +
              (activeFilter ===
              [
                "All cases",
                "Under Bank Review",
                "Awaiting Customer Consent",
                "Closed",
              ][i]
                ? " is-selected"
                : "")
            }
            aria-pressed={
              activeFilter ===
              [
                "All cases",
                "Under Bank Review",
                "Awaiting Customer Consent",
                "Closed",
              ][i]
            }
            key={m.label}
            onClick={() =>
              onFilter(
                [
                  "All cases",
                  "Under Bank Review",
                  "Awaiting Customer Consent",
                  "Closed",
                ][i],
              )
            }
          >
            <div>
              <span>{m.label}</span>
              <m.icon size={18} />
            </div>
            <strong>
              <Count value={m.value} />
              <ArrowUpRight size={21} />
            </strong>
            <p>{m.note}</p>
            <span className="metric-tag">{m.tag}</span>
          </button>
        ))}
      </section>
      <section className="analytics-grid">
        <section
          className="pipeline workflow-overview"
          aria-label="Case workflow"
        >
          <div className="pipeline-label">
            <span className="pipeline-icon">
              <Layers size={19} />
            </span>
            <div>
              <div className="workflow-heading-line">
                <strong>Case workflow</strong>
                {failed > 0 && (
                  <span className="workflow-heading-attention">
                    <span className="attention-signal" aria-hidden="true">
                      <span />
                    </span>
                    {failed} AI {failed === 1 ? "review needs" : "reviews need"}{" "}
                    attention
                  </span>
                )}
              </div>
            </div>
          </div>
          <ol
            className="workflow-journey"
            aria-label="Cases currently at each workflow stage"
          >
            {statuses.map((status, i) => {
              const count = rows.filter(
                (c) => workflowStage(c.status) === status,
              ).length;
              const Icon = [
                FileText,
                Sparkles,
                ShieldCheck,
                UserRound,
                Flag,
                CheckCircle2,
              ][i];
              return (
                <li
                  key={status}
                  className={`journey-stop journey-stop-${i + 1}${count ? " has-cases" : ""}`}
                >
                  <div className="journey-station">
                    <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                    <span
                      className="journey-count"
                      aria-label={`${count} cases`}
                    >
                      {count}
                    </span>
                  </div>
                  <div className="journey-caption">
                    <strong>
                      {
                        [
                          "Submitted",
                          "AI analysis",
                          "Bank review",
                          "Customer",
                          "Resolution",
                          "Closed",
                        ][i]
                      }
                    </strong>
                    <small>
                      {
                        [
                          "Customer submits",
                          "Evidence checks",
                          "Human decision",
                          "Review & consent",
                          "Bank finalizes",
                          "Outcome recorded",
                        ][i]
                      }
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </section>
    </div>
  );
}
