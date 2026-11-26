import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ToolActivityDialog } from "./ToolActivityDialog";
// Present duplicate candidates as evidence rather than proof, with human-readable currency and flags.
it("renders labelled transaction facts instead of escaped JSON", () => {
  const result = [
    {
      type: "text",
      text: JSON.stringify({
        possible_duplicates: [
          {
            id: "TX-1002",
            merchant: "Studio Supply",
            amount: 48500,
            currency: "AED",
            date: "2026-11-21",
            reversed: 0,
            account_id: "ACC-001",
          },
        ],
        note: "Matches are evidence, not proof of an erroneous charge.",
      }),
    },
  ];
  const html = renderToStaticMarkup(
    <ToolActivityDialog
      caseId="DSP-TEST"
      records={[
        {
          id: 1,
          created: "2026-11-25T10:00:00Z",
          body: JSON.stringify({
            name: "find_possible_duplicates",
            result: JSON.stringify(result),
          }),
        },
      ]}
      onClose={() => {}}
    />,
  );
  expect(html).toContain("Possible duplicate charges");
  expect(html).toContain("TX-1002");
  expect(html).toContain("485.00");
  expect(html).toContain("21 November 2026");
  expect(html).toContain("Matches are evidence, not proof");
  expect(html).not.toContain("annotations");
  expect(html).not.toContain("48500");
});
