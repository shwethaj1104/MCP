import { useState } from "react";
import { FileText, ArrowUpRight } from "lucide-react";
import { Badge } from "./Badge";
import { CaseSearch } from "./CaseSearch";
import { TablePagination } from "./TablePagination";
import { paginate } from "../lib/pagination";
import { caseDisplayStatus } from "../lib/case-status";
type CaseEntry = {
  id: string;
  reason: string;
  status: string;
  display_status?: string;
  error?: string | null;
  processing_state?: string | null;
  created: string;
  customer_id: string;
};

// Show current case status in chronological order without inventing audit events.
export function ActivityView({
  rows,
  onSelect,
}: {
  rows: CaseEntry[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState({ key: "", value: 1 });
  const sorted = [...rows]
    .filter((row) =>
      `${row.id} ${row.reason} ${caseDisplayStatus(row)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.created.localeCompare(a.created));
  const key = JSON.stringify([query, pageSize]);
  const pagination = paginate(
    sorted,
    page.key === key ? page.value : 1,
    pageSize,
  );
  return (
    <section className="panel activity-workspace">
      <div className="panel-heading">
        <h2>Case register</h2>
        <CaseSearch
          value={query}
          onChange={setQuery}
          label="Search case register"
          placeholder="Find case or status…"
        />
      </div>
      <div className="activity-column-head" aria-hidden="true">
        <span>Submitted</span>
        <span>Case</span>
        <span>Current status</span>
        <span />
      </div>
      <div className="activity-entries">
        {pagination.visibleCases.map((entry) => {
          const date = new Date(entry.created);
          return (
            <button
              key={entry.id}
              className="activity-entry"
              onClick={() => onSelect(entry.id)}
              aria-label={`Open ${entry.id}: ${entry.reason}, ${caseDisplayStatus(entry)}`}
            >
              <time dateTime={entry.created} className="activity-date">
                <strong>
                  {date.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Dubai",
                  })}
                </strong>
                <span>
                  {date
                    .toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "Asia/Dubai",
                    })
                    .toUpperCase()}
                </span>
              </time>
              <span className="activity-case">
                <span className="activity-case-icon">
                  <FileText size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>{entry.reason}</strong>
                  <small>{entry.id}</small>
                </span>
              </span>
              <span className="activity-status">
                <Badge
                  status={caseDisplayStatus(entry)}
                  paused={Boolean(entry.error)}
                />
              </span>
              <ArrowUpRight
                size={18}
                className="activity-open"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {!sorted.length && (
        <div className="empty">
          <FileText size={27} />
          <h3>{rows.length ? "No matching cases" : "No cases yet"}</h3>
        </div>
      )}
      <TablePagination
        {...pagination}
        total={sorted.length}
        pageSize={pageSize}
        onSize={setPageSize}
        onPage={(value) => setPage({ key, value })}
        label="cases"
      />
    </section>
  );
}
