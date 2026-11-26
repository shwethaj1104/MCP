import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

// Exercise page boundaries, final partial pages and disappearing records using the actual table helper.
describe("dispute pagination", () => {
  it("covers every record exactly once across pages", () => {
    const rows = Array.from({ length: 12 }, (_, i) => i + 1);
    const pages = [1, 2, 3].map((page) => paginate(rows, page, 5));
    expect(pages.flatMap((page) => page.visibleCases)).toEqual(rows);
    expect(pages[2]).toMatchObject({
      first: 11,
      last: 12,
      currentPage: 3,
      pageCount: 3,
    });
  });
  it("clamps an outdated page after filtering or deleting records", () => {
    expect(paginate([1, 2], 4, 5)).toMatchObject({
      currentPage: 1,
      first: 1,
      last: 2,
    });
    expect(paginate([], 4, 5)).toMatchObject({
      currentPage: 1,
      first: 0,
      last: 0,
      visibleCases: [],
    });
  });
});
