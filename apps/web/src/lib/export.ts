type ExportCase = {
  id: string;
  customer_id: string;
  reason: string;
  status: string;
  transaction_id: string;
};
// Escape CSV cells and prevent spreadsheet formulas in customer-provided text.
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
// Serialize only the visible case queue using stable, human-readable column names.
export function createCaseCsv(rows: ExportCase[]) {
  return [
    ["Case", "Customer", "Reason", "Status", "Transaction"],
    ...rows.map((c) => [
      c.id,
      c.customer_id,
      c.reason,
      c.status,
      c.transaction_id,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
