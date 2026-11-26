import { describe, expect, it } from "vitest";
import {
  readToolEvidence,
  evidenceValue,
  unwrapEvidence,
} from "./tool-evidence";
describe("human readable banking evidence", () => {
  // Remove MCP transport metadata and decode its text payload without corrupting source strings.
  it("unwraps stored text envelopes and retains exact customer text", () => {
    const record = {
      id: 1,
      created: "2026-11-25T10:00:00Z",
      body: JSON.stringify({
        name: "get_case_evidence",
        result: JSON.stringify([
          {
            type: "text",
            text: JSON.stringify({
              statement: "12345",
              responses: ["plain receipt"],
              reason: "Duplicate charge",
            }),
            annotations: null,
            _meta: null,
          },
        ]),
      }),
    };
    expect(readToolEvidence(record).data).toEqual({
      statement: "12345",
      responses: ["plain receipt"],
      reason: "Duplicate charge",
    });
  });
  // Correctly convert integer minor units and zero/one reversal flags.
  it("formats money, dates and flags without exposing raw banking encodings", () => {
    expect(evidenceValue("amount", 48500, "AED")).toContain("485.00");
    expect(evidenceValue("reversed", 0)).toBe("No");
    expect(evidenceValue("reversed", 1)).toBe("Yes");
    expect(evidenceValue("date", "2026-11-21")).toBe("21 November 2026");
    expect(evidenceValue("action", "provide_information")).toBe(
      "Additional information supplied",
    );
  });
  // Preserve nested response objects and handle malformed outer audit records gracefully.
  it("handles empty and malformed records safely", () => {
    expect(unwrapEvidence([])).toEqual([]);
    expect(
      readToolEvidence({ id: 1, created: "2026-11-25", body: "bad" }).data,
    ).toContain("could not be decoded");
  });
});
