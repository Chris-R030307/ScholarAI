import { describe, expect, it } from "vitest";
import type { Paper } from "@/lib/paper";
import {
  applyFiltersAndSort,
  compareImpactful,
  defaultSearchResultFilters,
  filterPapers,
} from "@/lib/result-filters";

function p(over: Partial<Paper> & Pick<Paper, "id" | "title">): Paper {
  return {
    abstract: null,
    url: null,
    year: null,
    citationCount: 0,
    isOpenAccess: false,
    authors: [],
    venue: null,
    ...over,
  };
}

describe("compareImpactful", () => {
  it("orders by citationCount descending", () => {
    const a = p({ id: "a", title: "A", citationCount: 5 });
    const b = p({ id: "b", title: "B", citationCount: 10 });
    expect(compareImpactful(a, b)).toBeGreaterThan(0);
    expect(compareImpactful(b, a)).toBeLessThan(0);
  });

  it("ties break by year descending then title", () => {
    const x = p({ id: "x", title: "Zebra", citationCount: 1, year: 2020 });
    const y = p({ id: "y", title: "Apple", citationCount: 1, year: 2021 });
    expect(compareImpactful(x, y)).toBeGreaterThan(0);
    const sameYearA = p({ id: "a", title: "B", citationCount: 2, year: 2022 });
    const sameYearB = p({ id: "b", title: "A", citationCount: 2, year: 2022 });
    expect(compareImpactful(sameYearA, sameYearB)).toBeGreaterThan(0);
  });
});

describe("filterPapers", () => {
  it("filters open access and citations", () => {
    const papers = [
      p({ id: "1", title: "T", citationCount: 10, isOpenAccess: true }),
      p({ id: "2", title: "T", citationCount: 3, isOpenAccess: true }),
    ];
    const f = defaultSearchResultFilters();
    f.openAccessOnly = true;
    f.minCitations = 5;
    expect(filterPapers(papers, f).map((x) => x.id)).toEqual(["1"]);
  });
});

describe("applyFiltersAndSort", () => {
  it("preserves load order when impactful is off", () => {
    const papers = [
      p({ id: "a", title: "A", citationCount: 100 }),
      p({ id: "b", title: "B", citationCount: 1 }),
    ];
    const f = defaultSearchResultFilters();
    const out = applyFiltersAndSort(papers, f);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("sorts by impact when impactful is on", () => {
    const papers = [
      p({ id: "a", title: "A", citationCount: 1 }),
      p({ id: "b", title: "B", citationCount: 50 }),
    ];
    const f = defaultSearchResultFilters();
    f.impactful = true;
    expect(applyFiltersAndSort(papers, f).map((x) => x.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
