// Clamp pagination to the available records and expose consistent visible-range metadata.
export function paginate<T>(
  rows: T[],
  requestedPage: number,
  requestedSize: number,
) {
  const size = Math.max(1, Math.floor(requestedSize));
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.max(
    1,
    Math.min(Math.floor(requestedPage), pageCount),
  );
  const pageStart = (currentPage - 1) * size;
  return {
    pageCount,
    currentPage,
    pageStart,
    first: rows.length ? pageStart + 1 : 0,
    last: Math.min(pageStart + size, rows.length),
    visibleCases: rows.slice(pageStart, pageStart + size),
  };
}
