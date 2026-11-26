import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ActivityView } from "./ActivityView";

// Verify the register shows actual cases newest first and uses the shared pagination boundary.
it("orders actual submissions, formats Dubai time and limits the first page", () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({
    id: `CASE-${index}`,
    reason: `Reason ${index}`,
    status: "Under Bank Review",
    created: `2026-11-${String(10 + index).padStart(2, "0")}T16:00:00Z`,
    customer_id: "customer-1",
  }));
  const html = renderToStaticMarkup(
    <ActivityView rows={rows} onSelect={() => {}} />,
  );
  expect(html.indexOf("Reason 6")).toBeLessThan(html.indexOf("Reason 5"));
  expect(html).toContain("08:00 PM");
  expect(html).not.toContain("Reason 0");
  expect(html).toContain("1–5 of 7 cases");
  expect(html).toContain("Page 1 of 2");
  expect(html).not.toContain("Nothing gets");
});
