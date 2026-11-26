import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SelectField } from "./SelectField";
// Preserve the backend form-field contract when replacing a native select with a custom menu.
it("submits the exact first option value through a named hidden field", () => {
  const html = renderToStaticMarkup(
    <SelectField
      name="transaction_id"
      label="Transaction"
      options={[
        {
          value: "TX-1001",
          label: "TX-1001 · Studio Supply",
          description: "AED 485.00",
        },
        { value: "TX-1002", label: "TX-1002 · Studio Supply" },
      ]}
    />,
  );
  expect(html).toContain('name="transaction_id"');
  expect(html).toContain('value="TX-1001"');
  expect(html).toContain('role="combobox"');
  expect(html).toContain('aria-label="Transaction"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("AED 485.00");
});

// Keep the displayed selection and submitted value aligned with externally retained pagination state.
it("shows the controlled page size after the dropdown remounts", () => {
  const html = renderToStaticMarkup(
    <SelectField
      name="page-size"
      label="Rows per page"
      value="20"
      options={[5, 10, 20, 50].map((size) => ({
        value: String(size),
        label: String(size),
      }))}
    />,
  );
  expect(html).toContain('value="20"');
  expect(html).toContain("<strong>20</strong>");
});
