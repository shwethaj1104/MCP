import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  LayoutDashboard,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ShieldCheck,
  FileText,
  Clock3,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  Activity,
  Wallet,
  CheckCircle2,
  CalendarDays,
  Download,
} from "lucide-react";
type Row = Record<string, any>;

import { money, decode, api } from "./lib/api";
import { Badge } from "./components/Badge";
import { Dialog } from "./components/Dialog";
import { Overview } from "./components/Overview";
import { TransactionExplorer } from "./components/TransactionExplorer";
import { ActivityView } from "./components/ActivityView";
import { SidebarMotion } from "./components/SidebarMotion";
import { CaseHeader } from "./components/CaseHeader";
import { CaseHistoryEntry } from "./components/CaseHistoryEntry";
import { paginate } from "./lib/pagination";
import { CaseSearch } from "./components/CaseSearch";
import { TablePagination } from "./components/TablePagination";
import { createCaseCsv } from "./lib/export";
import {
  caseDisplayStatus,
  workflowStage,
  type CaseStatus,
} from "./lib/case-status";
import { WorkflowProgress } from "./components/WorkflowProgress";
import { SelectField } from "./components/SelectField";
import { ErrorToast } from "./components/ErrorToast";
import { ToolActivityDialog } from "./components/ToolActivityDialog";
import { processingInterval, type ProcessingCase } from "./lib/polling";
import {
  IdentitySwitcher,
  type DemoIdentity,
} from "./components/IdentitySwitcher";
// Render the interactive banking workbench and its human review surfaces.
export default function App() {
  const [params, setParams] = useSearchParams();
  const page = params.get("page") || "Overview";
  const selected = params.get("case");
  // Navigate to a workspace section while preserving browser history.
  function setPage(value: string) {
    setParams({ page: value });
  }
  // Navigate to a case or return to the current workspace section.
  function setSelected(value: string | null) {
    setFeedback("");
    setError("");
    setParams(value ? { page, case: value } : { page });
  }
  const [identity, setIdentity] = useState("reviewer-1"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All cases"),
    [form, setForm] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [dismissedToast, setDismissedToast] = useState<string | null>(null),
    [toolsOpen, setToolsOpen] = useState(false);
  // Close the evidence popup when navigation or demo identity changes.
  useEffect(() => setToolsOpen(false), [selected, identity]);
  // Restore the evidence trigger focus when dismissing its dialog.
  const closeTools = useCallback(() => setToolsOpen(false), []);
  const pollStarts = useRef(new Map<string, number>());
  const [pageSize, setPageSize] = useState(5);
  const [queuePage, setQueuePage] = useState({ key: "", page: 1 });
  // Close the customer form without losing its previous keyboard focus.
  const closeForm = useCallback(() => setForm(false), []);
  // Close the approval preview without changing the pending proposal.
  const closePreview = useCallback(() => setPreview(false), []);
  const qc = useQueryClient();
  const reviewer = identity === "reviewer-1";
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/identities", identity),
    staleTime: Infinity,
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api("/health", identity),
    staleTime: 60000,
  });
  const cases = useQuery({
    queryKey: ["cases", identity],
    queryFn: () => api("/cases", identity),
    enabled: !selected,
    refetchInterval: (query) =>
      selected || query.state.error
        ? false
        : processingInterval(
            (query.state.data || []) as ProcessingCase[],
            pollStarts.current,
          ),
    refetchIntervalInBackground: false,
  });
  const transactions = useQuery({
    queryKey: ["transactions", identity],
    queryFn: () => api("/transactions", identity),
    staleTime: 60000,
  });
  const detail = useQuery({
    queryKey: ["case", selected, identity],
    queryFn: () => api("/cases/" + selected, identity),
    enabled: !!selected,
    refetchInterval: (query) =>
      query.state.error || !query.state.data
        ? false
        : processingInterval(
            [query.state.data as ProcessingCase],
            pollStarts.current,
          ),
    refetchIntervalInBackground: false,
  });
  const rows: Row[] = cases.data || [];
  const txs: Row[] = transactions.data || [];
  const item = detail.data;
  const notification =
    error ||
    (cases.error as Error | null)?.message ||
    (detail.error as Error | null)?.message ||
    item?.error;
  const notificationKey = `${identity}:${selected || "queue"}:${item?.version || 0}:${notification || ""}`;
  const showNotification = Boolean(
    notification && dismissedToast !== notificationKey,
  );
  const report = decode(item?.report || "{}");
  const proposal = item?.records
    ?.filter((r: Row) => r.kind === "proposal")
    .at(-1);
  const offer = proposal ? decode(proposal.body) : null;
  const filtered = rows.filter(
    (c) =>
      (filter === "All cases" ||
        caseDisplayStatus(c as CaseStatus) === filter ||
        workflowStage(c.status) === filter) &&
      `${c.id} ${c.reason} ${c.customer_id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const paginationKey = JSON.stringify([
    identity,
    filter,
    search,
    pageSize,
    page,
  ]);
  const { pageCount, currentPage, first, last, visibleCases } = paginate(
    filtered,
    queuePage.key === paginationKey ? queuePage.page : 1,
    pageSize,
  );
  // Reset view state when switching the explicit demonstration identity.
  function switchIdentity(value: string) {
    setIdentity(value);
    setFilter("All cases");
    setSearch("");
    setForm(false);
    setPreview(false);
    setFeedback("");
    setError("");
    setPage("Overview");
  }
  // Refresh only case data and reset the bounded processing watch after an explicit action.
  async function refreshCases() {
    pollStarts.current.clear();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cases"] }),
      qc.invalidateQueries({ queryKey: ["case"] }),
    ]);
  }
  // Submit a versioned human decision and refresh all affected views.
  async function action(kind: string) {
    if (!item) return;
    setBusy(true);
    setError("");
    setDismissedToast(null);
    try {
      await api(`/cases/${item.id}/actions`, identity, {
        action: kind,
        version: item.version,
        feedback,
      });
      setFeedback("");
      setPreview(false);
      await refreshCases();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Save the customer's simple dispute form and navigate to the new case.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    setDismissedToast(null);
    try {
      const result = await api("/cases", identity, values);
      setForm(false);
      setSelected(result.id);
      await refreshCases();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Download the currently visible case queue as a CSV without transmitting it externally.
  function exportCases() {
    const csv = createCaseCsv(
      filtered as {
        id: string;
        customer_id: string;
        reason: string;
        status: string;
        transaction_id: string;
      }[],
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "resolvedesk-disputes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  // Focus the queue on the workload selected in an overview chart or metric.
  function focusQueue(status: string) {
    setFilter(status);
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setSelected(null)}>
          <span className="brandmark">
            <Layers size={23} />
          </span>
          ResolveDesk<span className="branddot">.</span>
        </a>
        <span className="workspace-label">WORKSPACE</span>
        <nav aria-label="Primary navigation">
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Disputes", icon: FileText },
            { name: "Transactions", icon: Wallet },
            { name: "Activity", icon: Activity },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={
                (selected ? name === "Disputes" : page === name)
                  ? "nav active"
                  : "nav"
              }
              aria-current={
                (selected ? name === "Disputes" : page === name)
                  ? "page"
                  : undefined
              }
              onClick={() => {
                setPage(name);
              }}
            >
              <Icon size={18} />
              {name}
              {name === "Disputes" && (
                <span className="count">{rows.length}</span>
              )}
            </button>
          ))}
        </nav>
        <SidebarMotion />
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={13} />{" "}
            <strong>{selected ? "Case investigation" : page}</strong>
          </span>
          <div className="top-right">
            {health.data && !health.data.configured && (
              <span
                className="setup-status"
                title="Add OPENROUTER_API_KEY to the local .env file and restart the backend to enable live analysis."
              >
                <span />
                AI setup required
              </span>
            )}
            <IdentitySwitcher
              identities={(users.data || []) as DemoIdentity[]}
              value={identity}
              onChange={switchIdentity}
            />
          </div>
        </header>
        <div
          className={`content${!selected && page === "Overview" ? " dashboard-content" : ""}`}
        >
          {!selected ? (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {reviewer
                      ? "OPERATIONS / DISPUTE MANAGEMENT"
                      : "YOUR BANKING / DISPUTE SUPPORT"}
                  </div>
                  <h1>
                    {page === "Overview"
                      ? reviewer
                        ? "Your disputes, in perspective."
                        : "A little clarity. A lot of confidence."
                      : page}
                  </h1>
                  {page === "Overview" && (
                    <p>
                      {reviewer
                        ? "A considered workspace for the decisions that matter."
                        : "Raise a concern, follow its progress, and review the proposed resolution."}
                    </p>
                  )}
                </div>
                <div className="heading-actions">
                  <span className="date-chip">
                    <CalendarDays size={15} />
                    {new Date().toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {reviewer && (
                    <button className="export-button" onClick={exportCases}>
                      <Download size={15} />
                      Export cases
                    </button>
                  )}
                  {!reviewer && (
                    <button className="primary" onClick={() => setForm(true)}>
                      <Plus size={17} />
                      Raise a dispute
                    </button>
                  )}
                </div>
              </div>
              {page === "Overview" && (
                <Overview
                  rows={
                    rows as {
                      id: string;
                      status: string;
                      transaction_id: string;
                      created: string;
                    }[]
                  }
                  transactions={txs as { id: string; amount: number }[]}
                  reviewer={reviewer}
                  activeFilter={filter}
                  onFilter={focusQueue}
                />
              )}
              {page === "Transactions" ? (
                <TransactionExplorer
                  transactions={
                    txs as {
                      id: string;
                      account_id: string;
                      merchant: string;
                      amount: number;
                      currency: string;
                      date: string;
                      reversed: number;
                    }[]
                  }
                />
              ) : page === "Activity" ? (
                <ActivityView
                  rows={
                    rows as {
                      id: string;
                      reason: string;
                      status: string;
                      created: string;
                      customer_id: string;
                    }[]
                  }
                  onSelect={setSelected}
                />
              ) : (
                <section className="panel queue-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="smallcaps">THE DETAILS THAT MATTER</span>
                      <h2>{reviewer ? "Dispute queue" : "Your disputes"}</h2>
                      <p>A closer look at every open question.</p>
                    </div>
                    <div className="queue-header-actions">
                      <CaseSearch value={search} onChange={setSearch} />
                      <button
                        className="queue-refresh"
                        onClick={() => {
                          pollStarts.current.clear();
                          void refreshCases();
                        }}
                        aria-label="Refresh workspace"
                      >
                        <RefreshCw size={14} />
                        Refresh
                      </button>
                    </div>
                  </div>
                  {page !== "Overview" && (
                    <div className="table-tools">
                      <div className="tabs">
                        {[
                          "All cases",
                          "Under Bank Review",
                          "Awaiting Customer Consent",
                          "Closed",
                        ].map((t) => (
                          <button
                            key={t}
                            className={filter === t ? "selected" : ""}
                            onClick={() => setFilter(t)}
                          >
                            {t === "Under Bank Review"
                              ? "Needs review"
                              : t === "Awaiting Customer Consent"
                                ? "With customer"
                                : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Case / customer</th>
                          <th>Dispute reason</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCases.map((c) => {
                          const tx = txs.find((t) => t.id === c.transaction_id);
                          return (
                            <tr key={c.id} onClick={() => setSelected(c.id)}>
                              <td>
                                <div className="case-identity">
                                  <span className="case-symbol">
                                    <FileText size={17} />
                                  </span>
                                  <div>
                                    <button
                                      className="case-link"
                                      onClick={() => setSelected(c.id)}
                                    >
                                      {c.id}
                                    </button>
                                    <small>
                                      {
                                        users.data?.find(
                                          (u: Row) => u.id === c.customer_id,
                                        )?.name
                                      }
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {c.reason}
                                <small>{tx?.merchant}</small>
                              </td>
                              <td className="amount">
                                {money(tx?.amount || 0)}
                              </td>
                              <td>
                                <Badge
                                  status={caseDisplayStatus(c as CaseStatus)}
                                  paused={Boolean(c.error)}
                                />
                                {c.error && (
                                  <small>Processing needs attention</small>
                                )}
                              </td>
                              <td>
                                {new Date(c.created).toLocaleDateString(
                                  "en-GB",
                                  { day: "2-digit", month: "short" },
                                )}
                              </td>
                              <td>
                                <ArrowUpRight size={17} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <div className="empty">
                      <span className="empty-icon">
                        <FileText size={28} />
                      </span>
                      <h3>
                        {rows.length
                          ? "No matching disputes"
                          : "A fresh start for every case."}
                      </h3>
                      <p>
                        {reviewer
                          ? "Customer submissions will appear here, ready for an evidence-led review."
                          : "Start by selecting a transaction and telling us what happened."}
                      </p>
                      {!reviewer && (
                        <button
                          className="primary"
                          onClick={() => setForm(true)}
                        >
                          Raise your first dispute <ArrowRight size={15} />
                        </button>
                      )}
                    </div>
                  )}
                  <TablePagination
                    first={first}
                    last={last}
                    total={filtered.length}
                    currentPage={currentPage}
                    pageCount={pageCount}
                    pageSize={pageSize}
                    onSize={setPageSize}
                    onPage={(next) =>
                      setQueuePage({ key: paginationKey, page: next })
                    }
                    label="cases"
                  />
                </section>
              )}
              <footer>RESOLVEDESK / DISPUTE WORKBENCH</footer>
            </>
          ) : item ? (
            <>
              <CaseHeader
                item={item}
                onRetry={
                  reviewer && item.error ? () => action("retry") : undefined
                }
                retrying={busy}
                onTools={reviewer ? () => setToolsOpen(true) : undefined}
                onRefresh={() => void refreshCases()}
                onBack={() => {
                  setPage("Disputes");
                  setError("");
                  setFeedback("");
                }}
              />
              <WorkflowProgress item={item} />
              <div className="case-grid">
                <div>
                  <section className="panel detail-panel customer-statement-panel">
                    <div className="panel-heading">
                      <h2>Customer statement</h2>
                      <span className="pill">Original submission</span>
                    </div>
                    <p className="statement">{item.description}</p>
                  </section>
                  {reviewer && (
                    <section className="panel detail-panel">
                      <div className="panel-heading">
                        <h2>
                          <Layers size={18} /> Investigation report
                        </h2>
                        <span className="pill">AI ASSISTED</span>
                      </div>
                      {report.summary ? (
                        <>
                          <p className="statement">{report.summary}</p>
                          <div className="report-grid">
                            <div>
                              <span className="smallcaps">
                                RECOMMENDED OUTCOME
                              </span>
                              <h3>{report.outcome}</h3>
                            </div>
                            <div>
                              <span className="smallcaps">PROPOSED AMOUNT</span>
                              <h3>{money(report.amount)}</h3>
                            </div>
                          </div>
                          <h4>Checks completed</h4>
                          {report.completed_checks?.map((s: string) => (
                            <p className="check-line" key={s}>
                              <CheckCircle2 size={15} />
                              {s}
                            </p>
                          ))}
                          <h4>Evidence references</h4>
                          <p>{report.evidence_references?.join(" · ")}</p>
                          {!!report.missing_information?.length && (
                            <>
                              <h4>Missing information</h4>
                              <p>{report.missing_information.join("; ")}</p>
                            </>
                          )}
                          <details>
                            <summary>Previous report versions</summary>
                            {item.records
                              .filter((r: Row) => r.kind === "report")
                              .map((r: Row) => (
                                <div className="history-report" key={r.id}>
                                  <small>
                                    {new Date(r.created).toLocaleString()}
                                  </small>
                                  <p>{decode(r.body).summary}</p>
                                </div>
                              ))}
                          </details>
                        </>
                      ) : (
                        <div className="empty">
                          <Layers size={26} />
                          <h3>
                            {item.error
                              ? "Investigation paused"
                              : health.data?.configured
                                ? "Investigation in progress"
                                : "Ready when you are."}
                          </h3>
                          <p>
                            {item.error
                              ? "The report could not be completed. A bank reviewer can retry processing."
                              : health.data?.configured
                                ? "The report will appear after the banking tools complete."
                                : "Add your OpenRouter key to start live analysis. No synthetic report will be generated."}
                          </p>
                        </div>
                      )}
                    </section>
                  )}
                  {!reviewer && offer && (
                    <section className="panel detail-panel">
                      <div className="panel-heading">
                        <h2>
                          {offer.type === "information"
                            ? "Additional information requested"
                            : "Your proposed resolution"}
                        </h2>
                        <ShieldCheck size={19} />
                      </div>
                      <p className="statement">
                        {offer.type === "information"
                          ? offer.message
                          : offer.report.explanation}
                      </p>
                      {offer.type !== "information" && (
                        <div className="report-grid">
                          <div>
                            <span className="smallcaps">OUTCOME</span>
                            <h3>{offer.report.outcome}</h3>
                          </div>
                          <div>
                            <span className="smallcaps">PROPOSED AMOUNT</span>
                            <h3>{money(offer.report.amount)}</h3>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                  {((reviewer &&
                    !item.id.startsWith("FIXTURE-") &&
                    item.status === "Under Bank Review") ||
                    (!reviewer &&
                      item.status === "Awaiting Customer Consent")) && (
                    <section className="panel decision">
                      <h2>
                        {reviewer
                          ? "Your decision moves this forward."
                          : "Take a moment. Review your response."}
                      </h2>
                      <p>
                        {reviewer
                          ? "Check the evidence, then approve the exact proposal or send feedback for reanalysis."
                          : "Acceptance applies only to the proposal shown above. Sharing information is not consent."}
                      </p>
                      <label>
                        {reviewer
                          ? "Reviewer feedback / information request"
                          : "Your response"}
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder={
                            reviewer
                              ? "What should be checked or clarified?"
                              : "Add details if you disagree or provide requested information…"
                          }
                        />
                      </label>
                      <div className="actions">
                        {reviewer ? (
                          <>
                            <button
                              className="primary"
                              disabled={busy || !report.summary}
                              onClick={() => setPreview(true)}
                            >
                              <Check size={16} />
                              Approve & send
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => action("rerun")}
                            >
                              <RefreshCw size={16} />
                              Rerun analysis
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => action("request_information")}
                            >
                              Request information
                            </button>
                          </>
                        ) : offer?.type === "information" ? (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => action("provide_information")}
                          >
                            Send information <ArrowRight size={16} />
                          </button>
                        ) : (
                          <>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => action("accept")}
                            >
                              <Check size={16} />
                              Accept resolution
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => action("disagree")}
                            >
                              Disagree & explain
                            </button>
                          </>
                        )}
                      </div>
                    </section>
                  )}
                  {item.status === "Closed" && (
                    <section className="panel decision">
                      <CheckCircle2 size={28} />
                      <h2>Resolution completed.</h2>
                      {item.resolution && (
                        <div className="report-grid">
                          <strong>{item.resolution.outcome}</strong>
                          <strong>{money(item.resolution.amount)}</strong>
                        </div>
                      )}
                      <p>
                        The final outcome has been recorded in your portal. Any
                        credit shown is simulated; no real funds moved.
                      </p>
                    </section>
                  )}
                </div>
                <aside className="case-aside">
                  <section className="panel history-panel">
                    <div className="panel-heading">
                      <h2>Case history</h2>
                      <Clock3 size={17} />
                    </div>
                    <div className="timeline">
                      {item.records
                        .filter(
                          (r: Row) => r.kind !== "tool" && r.kind !== "report",
                        )
                        .map((r: Row) => (
                          <CaseHistoryEntry
                            key={r.id}
                            record={
                              r as {
                                kind: string;
                                actor: string;
                                created: string;
                                body: string;
                              }
                            }
                          />
                        ))}
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <div className="empty">Loading case…</div>
          )}
        </div>
      </main>
      {toolsOpen && selected && item && reviewer && (
        <ToolActivityDialog
          caseId={item.id}
          records={item.records.filter((record: Row) => record.kind === "tool")}
          onClose={closeTools}
        />
      )}
      {showNotification && (
        <ErrorToast
          key={notificationKey}
          title={
            item?.error
              ? "Investigation needs attention"
              : "Something needs attention"
          }
          message={notification}
          onDismiss={() => setDismissedToast(notificationKey)}
        />
      )}
      {form && (
        <Dialog onClose={closeForm}>
          <section
            className="modal dispute-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-case"
          >
            <button
              className="close"
              aria-label="Close form"
              onClick={() => setForm(false)}
            >
              <X size={20} />
            </button>
            <span className="step-icon">
              <FileText size={22} />
            </span>
            <div className="modal-kicker">NEW DISPUTE / 01</div>
            <h2 id="new-case">Let's get this sorted.</h2>
            <p>Tell us about the transaction. We'll investigate the details.</p>
            <form className="dispute-form" onSubmit={submit}>
              <label className="transaction-field">
                Transaction
                <SelectField
                  name="transaction_id"
                  label="Transaction"
                  options={txs.map((tx) => ({
                    value: tx.id,
                    label: `${tx.id} · ${tx.merchant}`,
                    description: money(tx.amount),
                  }))}
                />
              </label>
              <label className="reason-field">
                Dispute reason
                <SelectField
                  name="reason"
                  label="Dispute reason"
                  options={[
                    {
                      value: "Duplicate charge",
                      label: "Duplicate charge",
                      description:
                        "The same purchase was charged more than once",
                    },
                    {
                      value: "Charge already reversed",
                      label: "Charge already reversed",
                      description: "Check a charge that has been reversed",
                    },
                    {
                      value: "Incorrect amount",
                      label: "Incorrect amount",
                      description: "The amount differs from the agreed price",
                    },
                    {
                      value: "Service not received",
                      label: "Service not received",
                      description:
                        "A paid purchase or service was not delivered",
                    },
                    {
                      value: "Unrecognized transaction",
                      label: "Unrecognized transaction",
                      description: "You do not recognize this payment",
                    },
                  ]}
                />
              </label>
              <label className="description-field">
                What happened?
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={10000}
                  placeholder="Explain the issue in your own words…"
                />
              </label>
              <label className="evidence-field">
                Supporting evidence{" "}
                <span className="muted">(optional text, up to 100 KB)</span>
                <textarea
                  name="evidence"
                  maxLength={100000}
                  placeholder="Paste a receipt, merchant correspondence, or other supporting text…"
                />
              </label>
              {error && (
                <p className="dispute-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dispute-form-footer">
                <p className="form-assurance">
                  <ShieldCheck size={13} /> Your claim is reviewed before any
                  resolution.
                </p>
                <button className="primary wide" disabled={busy || !txs.length}>
                  {busy ? "Submitting…" : "Submit dispute"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </section>
        </Dialog>
      )}
      {preview && (
        <Dialog onClose={closePreview}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-title"
          >
            <h2 id="approve-title">Approve this proposal?</h2>
            <p>
              This exact explanation and amount will be sent to the customer for
              consent.
            </p>
            <div className="report-grid">
              <strong>{report.outcome}</strong>
              <strong>{money(report.amount)}</strong>
            </div>
            <p>{report.explanation}</p>
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => action("approve")}
              >
                Approve & send
              </button>
              <button onClick={() => setPreview(false)}>Cancel</button>
            </div>
          </section>
        </Dialog>
      )}
    </div>
  );
}
