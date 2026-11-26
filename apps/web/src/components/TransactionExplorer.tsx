import { useState } from "react";
import {
  Search,
  Wallet,
  ArrowDownLeft,
  RotateCcw,
  Landmark,
} from "lucide-react";
import { money } from "../lib/api";
import { CaseSearch } from "./CaseSearch";
import { TablePagination } from "./TablePagination";
import { paginate } from "../lib/pagination";
type Transaction = {
  id: string;
  account_id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  reversed: number;
};
// Explore actual banking records through searchable merchant rows and account summaries.
export function TransactionExplorer({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [query, setQuery] = useState(""),
    [state, setState] = useState("All transactions");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState({ key: "", value: 1 });
  const visible = transactions.filter(
    (tx) =>
      `${tx.id} ${tx.merchant} ${tx.account_id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (state === "All transactions" ||
        (state === "Reversed" ? !!tx.reversed : !tx.reversed)),
  );
  const key = JSON.stringify([query, state, pageSize]);
  const pagination = paginate(
    visible,
    page.key === key ? page.value : 1,
    pageSize,
  );
  const accounts = new Set(transactions.map((tx) => tx.account_id)).size;
  const volume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const reversed = transactions.filter((tx) => tx.reversed).length;
  return (
    <div className="transactions-workspace">
      <section className="transaction-summary">
        <div className="ledger-intro">
          <span className="ledger-emblem">
            <Landmark size={27} strokeWidth={1.3} />
          </span>
          <div>
            <span className="smallcaps">CONNECTED ACCOUNTS</span>
            <h2>
              {accounts.toString().padStart(2, "0")}{" "}
              <span>in this workspace</span>
            </h2>
          </div>
        </div>
        <div>
          <span className="smallcaps">TRANSACTION VOLUME</span>
          <strong>{money(volume)}</strong>
          <small>Across {transactions.length} transactions</small>
        </div>
        <div>
          <span className="smallcaps">REVERSED CHARGES</span>
          <strong>
            {reversed.toString().padStart(2, "0")}
            <RotateCcw size={19} />
          </strong>
          <small>Already returned to the account</small>
        </div>
      </section>
      <section className="panel transaction-panel">
        <div className="panel-heading">
          <div>
            <h2>Transaction explorer</h2>
          </div>
          <CaseSearch
            value={query}
            onChange={setQuery}
            label="Search transactions"
            placeholder="Find merchant or reference…"
          />
        </div>
        <div className="table-tools">
          <div className="tabs" aria-label="Transaction status">
            {["All transactions", "Posted", "Reversed"].map((s) => (
              <button
                key={s}
                className={state === s ? "selected" : ""}
                aria-pressed={state === s}
                onClick={() => setState(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="transaction-result-count">
            {visible.length} transactions
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Merchant / reference</th>
                <th>Account</th>
                <th>Transaction date</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {pagination.visibleCases.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <div className="case-identity">
                      <span className="merchant-initial">
                        {tx.merchant
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{tx.merchant}</strong>
                        <small>{tx.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="account-ref">
                      <Wallet size={13} />
                      {tx.account_id}
                    </span>
                  </td>
                  <td>
                    {new Date(tx.date + "T12:00:00").toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </td>
                  <td>
                    <span
                      className={"badge " + (tx.reversed ? "" : "complete")}
                    >
                      {tx.reversed ? (
                        <RotateCcw size={11} />
                      ) : (
                        <ArrowDownLeft size={11} />
                      )}
                      {tx.reversed ? "Reversed" : "Posted"}
                    </span>
                  </td>
                  <td className="amount">{money(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty">
            <Search size={26} />
            <h3>No transactions found.</h3>
            <p>Try a different merchant name or reference.</p>
          </div>
        )}
        <TablePagination
          {...pagination}
          total={visible.length}
          pageSize={pageSize}
          onSize={setPageSize}
          onPage={(value) => setPage({ key, value })}
          label="transactions"
        />
      </section>
    </div>
  );
}
