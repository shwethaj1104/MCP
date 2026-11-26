import { describe, expect, it } from "vitest";
import { createCaseCsv } from "./export";
describe("case export", () => {
  // Neutralize formulas and retain quotes in user-supplied reasons.
  it("makes spreadsheet exports safe for customer-authored text", () => {
    const csv = createCaseCsv([
      {
        id: "C1",
        customer_id: "customer-1",
        reason: '=HYPERLINK("example")',
        status: "Submitted",
        transaction_id: "T1",
      },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv).toContain("\r\n");
  });
});
