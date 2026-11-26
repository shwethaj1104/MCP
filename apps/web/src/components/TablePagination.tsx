import { SelectField } from "./SelectField";

// Share accessible, synchronized pagination controls across workspace lists.
export function TablePagination({
  first,
  last,
  total,
  currentPage,
  pageCount,
  pageSize,
  onPage,
  onSize,
  label = "records",
}: {
  first: number;
  last: number;
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  label?: string;
}) {
  return (
    <div className="table-footer queue-pagination">
      <span role="status" aria-live="polite">
        {first}–{last} of {total} {label}
      </span>
      <nav className="pagination-controls" aria-label={`${label} pagination`}>
        <span>Rows per page</span>
        <SelectField
          name="page-size"
          label="Rows per page"
          value={String(pageSize)}
          options={[5, 10, 20, 50].map((size) => ({
            value: String(size),
            label: String(size),
          }))}
          onChange={(value) => onSize(Number(value))}
        />
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPage(currentPage - 1)}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="page-indicator">
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          disabled={currentPage >= pageCount}
          onClick={() => onPage(currentPage + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </nav>
    </div>
  );
}
