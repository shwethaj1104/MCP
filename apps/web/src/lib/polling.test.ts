import { describe, expect, it } from "vitest";
import {
  isCaseProcessing,
  processingInterval,
  type ProcessingCase,
} from "./polling";
const base: ProcessingCase = {
  id: "C1",
  version: 1,
  status: "AI Review in Progress",
};
describe("bounded background-job polling", () => {
  // A failure is terminal for polling even when the case's business status still says AI review.
  it("stops failed investigations and waiting human checkpoints", () => {
    expect(
      isCaseProcessing({
        ...base,
        error: "Failure",
        processing_state: "running",
      }),
    ).toBe(false);
    expect(isCaseProcessing({ ...base, processing_state: "failed" })).toBe(
      false,
    );
    expect(
      isCaseProcessing({
        ...base,
        status: "Under Bank Review",
        processing_state: "done",
      }),
    ).toBe(false);
    expect(
      isCaseProcessing({ ...base, status: "Closed", processing_state: "done" }),
    ).toBe(false);
  });
  // Missing model configuration is a waiting condition, not a reason to poll forever.
  it("does not poll queued investigations awaiting configuration", () => {
    expect(
      isCaseProcessing({
        ...base,
        status: "Submitted",
        processing_state: "awaiting_configuration",
      }),
    ).toBe(false);
  });
  // Keep human-action transitions refreshed until their queued graph response is consumed.
  it("watches queued actions and stops immediately after completion", () => {
    const started = new Map<string, number>();
    expect(
      processingInterval(
        [
          {
            ...base,
            status: "Awaiting Customer Consent",
            processing_state: "queued",
          },
        ],
        started,
        100,
      ),
    ).toBe(2500);
    expect(
      processingInterval(
        [
          {
            ...base,
            status: "Awaiting Customer Consent",
            processing_state: "done",
          },
        ],
        started,
        200,
      ),
    ).toBe(false);
  });
  // Bound even a stalled background job and allow a new retry version to start a new watch.
  it("expires after five minutes and resets for a new retry version", () => {
    const started = new Map<string, number>();
    expect(
      processingInterval(
        [{ ...base, processing_state: "running" }],
        started,
        100,
      ),
    ).toBe(2500);
    expect(
      processingInterval(
        [{ ...base, processing_state: "running" }],
        started,
        300100,
      ),
    ).toBe(false);
    expect(
      processingInterval(
        [{ ...base, version: 2, processing_state: "queued" }],
        started,
        300101,
      ),
    ).toBe(2500);
  });
});
