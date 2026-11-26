import {
  ArrowLeft,
  ReceiptText,
  Store,
  Info,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Badge } from "./Badge";
import { money } from "../lib/api";
import { caseDisplayStatus } from "../lib/case-status";
type HeaderCase = {
  id: string;
  reason: string;
  status: string;
  transaction_id: string;
  error?: string | null;
  display_status?: string;
  processing_state?: string | null;
  transaction: { merchant: string; amount: number };
};
// Group case identity, transaction context, status and a prominent return action.
export function CaseHeader({
  item,
  onBack,
  onRetry,
  retrying = false,
  onRefresh,
  onTools,
}: {
  item: HeaderCase;
  onBack: () => void;
  onRetry?: () => void;
  retrying?: boolean;
  onRefresh?: () => void;
  onTools?: () => void;
}) {
  const fixture = item.id.startsWith("FIXTURE-");
  return (
    <section className="case-header" aria-label="Case overview">
      <div className="case-toolbar">
        <button className="case-back" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>Back to disputes</span>
        </button>
        <span className="case-reference">
          <span>CASE:</span> <strong>{item.id}</strong>
        </span>
        {fixture && <span className="sample-label">SAMPLE CASE</span>}
        {onRefresh && (
          <button
            className="case-refresh"
            onClick={onRefresh}
            aria-label="Refresh case"
            title="Refresh case"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
      <div className="case-title-row">
        <h1>{item.reason}</h1>
        <div className="case-status-actions">
          <div className="case-status-summary" role="status" aria-live="polite">
            <span>CASE STATUS</span>
            <Badge
              status={caseDisplayStatus(item)}
              paused={Boolean(item.error)}
            />
          </div>
          {onRetry && (
            <button
              className="primary case-retry"
              disabled={retrying}
              onClick={onRetry}
            >
              <RefreshCw
                size={16}
                className={retrying ? "processing-icon" : ""}
              />
              {retrying ? "Retrying…" : "Retry processing"}
            </button>
          )}
          {onTools && (
            <button className="primary case-tools" onClick={onTools}>
              <Activity size={16} />
              Banking tool activity
            </button>
          )}
        </div>
      </div>
      <div className="case-context">
        <span>
          <Store size={15} />
          {item.transaction.merchant}
        </span>
        <span className="case-amount">{money(item.transaction.amount)}</span>
        <span>
          <ReceiptText size={14} />
          {item.transaction_id}
        </span>
      </div>
      {fixture && (
        <div className="sample-notice">
          <Info size={13} />
          <span>
            Read-only preview. Create a new dispute to experience the live
            workflow.
          </span>
        </div>
      )}
    </section>
  );
}
