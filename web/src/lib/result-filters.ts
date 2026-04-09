import type { Paper } from "@/lib/paper";
import { classifyVenueKind } from "@/lib/venue-kind";

/** UI filter value; venue strings map via heuristic (unknown excluded for journal/conference). */
export type VenueKindFilter = "any" | "journal" | "conference";

export type SearchResultFilters = {
  yearMin: number | null;
  yearMax: number | null;
  minCitations: number | null;
  openAccessOnly: boolean;
  impactful: boolean;
  venueKind: VenueKindFilter;
};

export function defaultSearchResultFilters(): SearchResultFilters {
  return {
    yearMin: null,
    yearMax: null,
    minCitations: null,
    openAccessOnly: false,
    impactful: false,
    venueKind: "any",
  };
}

function passesYear(p: Paper, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return true;
  const y = p.year;
  if (y == null || !Number.isFinite(y)) return false;
  if (min != null && y < min) return false;
  if (max != null && y > max) return false;
  return true;
}

function passesVenueFilter(p: Paper, venueKind: VenueKindFilter): boolean {
  if (venueKind === "any") return true;
  const k = classifyVenueKind(p.venue);
  if (k === "unknown") return false;
  return k === venueKind;
}

export function filterPapers(papers: Paper[], f: SearchResultFilters): Paper[] {
  const minCit =
    f.minCitations != null && Number.isFinite(f.minCitations)
      ? Math.max(0, Math.floor(f.minCitations))
      : null;

  return papers.filter((p) => {
    if (!passesYear(p, f.yearMin, f.yearMax)) return false;
    if (minCit != null && p.citationCount < minCit) return false;
    if (f.openAccessOnly && !p.isOpenAccess) return false;
    if (!passesVenueFilter(p, f.venueKind)) return false;
    return true;
  });
}

/** Sort for Impactful: citations desc, then year desc, then title asc. */
export function compareImpactful(a: Paper, b: Paper): number {
  if (b.citationCount !== a.citationCount) {
    return b.citationCount - a.citationCount;
  }
  const ya = a.year ?? Number.NEGATIVE_INFINITY;
  const yb = b.year ?? Number.NEGATIVE_INFINITY;
  if (yb !== ya) return yb - ya;
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

/**
 * Apply filters; preserve API/load order when not impactful, else sort by citations.
 */
export function applyFiltersAndSort(
  papersInOrder: Paper[],
  f: SearchResultFilters,
): Paper[] {
  const filtered = filterPapers(papersInOrder, f);
  if (!f.impactful) {
    const index = new Map(papersInOrder.map((p, i) => [p.id, i]));
    return [...filtered].sort(
      (a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0),
    );
  }
  return [...filtered].sort(compareImpactful);
}
