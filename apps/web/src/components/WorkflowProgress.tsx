import { Check, X } from "lucide-react";
import {
  caseDisplayStatus,
  workflowStage,
  workflowStages,
  type CaseStatus,
} from "../lib/case-status";
// Keep failed, queued and running AI reviews in one clearly labelled workflow stage.
export function WorkflowProgress({ item }: { item: CaseStatus }) {
  const display = caseDisplayStatus(item),
    current = workflowStages.indexOf(workflowStage(display));
  return (
    <div className="progress" role="list" aria-label="Dispute status stages">
      {workflowStages.map((stage, index) => {
        const active = index === current;
        const failed = active && display === "AI Review Failed";
        return (
          <div
            key={stage}
            role="listitem"
            aria-current={active ? "step" : undefined}
            className={
              (index <= current ? "reached" : "") +
              (failed ? " stage-failed" : "")
            }
          >
            <span>
              {failed ? (
                <X size={16} />
              ) : index < current ? (
                <Check size={12} />
              ) : (
                index + 1
              )}
            </span>
            <small>{active ? display : stage}</small>
          </div>
        );
      })}
    </div>
  );
}
