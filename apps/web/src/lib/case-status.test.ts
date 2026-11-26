import { describe, expect, it } from "vitest";
import { caseDisplayStatus, workflowStage } from "./case-status";
describe("truthful AI review status", () => {
  // Never show a failed legacy case as active processing.
  it("shows failure even if the stored business status is still in progress", () => {
    expect(
      caseDisplayStatus({
        status: "AI Review in Progress",
        error: "Failed",
        processing_state: "failed",
      }),
    ).toBe("AI Review Failed");
  });
  // An unprocessed job and a missing setup are distinct from running work.
  it("distinguishes queued, missing configuration, and actual running jobs", () => {
    expect(
      caseDisplayStatus({ status: "Submitted", processing_state: "queued" }),
    ).toBe("AI Review Queued");
    expect(
      caseDisplayStatus({
        status: "AI Review in Progress",
        processing_state: "awaiting_configuration",
      }),
    ).toBe("AI Setup Required");
    expect(
      caseDisplayStatus({
        status: "AI Review Queued",
        processing_state: "running",
      }),
    ).toBe("AI Review in Progress");
  });
  // Keep six progress slots while changing the text within the AI slot.
  it("maps failures and queued retries to the existing AI stage", () => {
    expect(workflowStage("AI Review Failed")).toBe("AI Review in Progress");
    expect(workflowStage("AI Review Queued")).toBe("AI Review in Progress");
  });
});
