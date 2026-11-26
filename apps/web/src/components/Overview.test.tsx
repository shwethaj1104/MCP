import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Overview } from "./Overview";
import { TransactionExplorer } from "./TransactionExplorer";
// Render the actual aggregate views against known records without inventing analytics.
describe("record-backed dashboard", () => {
  // Keep counts and disputed volume tied to case transactions rather than every bank transaction.
  it("shows actual workload and only the volume attached to cases", () => {
    const html = renderToStaticMarkup(
      <Overview
        rows={[
          {
            id: "C1",
            status: "Under Bank Review",
            transaction_id: "T1",
            created: "2026-11-24",
          },
          {
            id: "C2",
            status: "Closed",
            transaction_id: "T2",
            created: "2026-11-24",
          },
        ]}
        transactions={[
          { id: "T1", amount: 10000 },
          { id: "T2", amount: 20000 },
          { id: "T3", amount: 99900 },
        ]}
        reviewer
        activeFilter="Closed"
        onFilter={() => {}}
      />,
    );
    expect(html).toContain("50");
    expect(html).toContain("Case workflow");
    expect(html).not.toContain("1,299.00");
    expect(html).not.toContain("Case distribution");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain("metric-3 is-selected");
  });
  // Provide an accessible empty chart instead of dividing by zero for a new workspace.
  it("handles an empty workspace without fabricated data", () => {
    const html = renderToStaticMarkup(
      <Overview rows={[]} transactions={[]} reviewer onFilter={() => {}} />,
    );
    expect(html).not.toContain("NaN");
    expect(html).toContain("Cases currently at each workflow stage");
    expect(html).toContain("0% of all submitted cases");
  });
  // Show account, merchant, and reversal evidence directly from supplied transaction records.
  it("renders merchant and reversal information in the explorer", () => {
    const html = renderToStaticMarkup(
      <TransactionExplorer
        transactions={[
          {
            id: "T1",
            account_id: "ACC-001",
            merchant: "Test Merchant",
            amount: 15000,
            currency: "AED",
            date: "2026-11-24",
            reversed: 1,
          },
        ]}
      />,
    );
    expect(html).toContain("Test Merchant");
    expect(html).toContain("ACC-001");
    expect(html).toContain("150.00");
    expect(html).toContain("Reversed");
  });
});
