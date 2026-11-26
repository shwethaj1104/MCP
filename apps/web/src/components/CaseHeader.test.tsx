import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CaseHeader } from "./CaseHeader";
// Keep case navigation explicit and sample disclosures visible in the consolidated header.
it("labels the return action and preserves transaction context", () => {
  const html = renderToStaticMarkup(
    <CaseHeader
      item={{
        id: "FIXTURE-002",
        reason: "Charge already reversed",
        status: "Under Bank Review",
        transaction_id: "TX-1003",
        transaction: { merchant: "Cloudline Travel", amount: 129000 },
      }}
      onBack={() => {}}
    />,
  );
  expect(html).toContain("Back to disputes");
  expect(html).toContain("Cloudline Travel");
  expect(html).toContain("1,290.00");
  expect(html).toContain("Read-only preview");
  expect(html).toContain("Under Bank Review");
});

// Keep operational actions distinct from the non-interactive case-status label.
it("places banking tools and retry actions beside an explicit status label", () => {
  const html = renderToStaticMarkup(
    <CaseHeader
      item={{
        id: "DSP-TEST",
        reason: "Duplicate charge",
        status: "AI Review in Progress",
        error: "Test failure",
        transaction_id: "TX-1001",
        transaction: { merchant: "Test", amount: 48500 },
      }}
      onBack={() => {}}
      onRetry={() => {}}
      onTools={() => {}}
    />,
  );
  expect(html).toContain("CASE STATUS");
  expect(html).toContain("Banking tool activity");
  expect(html).toContain("Retry processing");
  expect(html).toContain("primary case-tools");
  expect(html).toContain("primary case-retry");
});
