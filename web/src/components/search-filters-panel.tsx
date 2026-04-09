"use client";

import type { SearchResultFilters, VenueKindFilter } from "@/lib/result-filters";

type Props = {
  filters: SearchResultFilters;
  onChange: (next: SearchResultFilters) => void;
  disabled?: boolean;
};

function patch(f: SearchResultFilters, part: Partial<SearchResultFilters>) {
  return { ...f, ...part };
}

export function SearchFiltersPanel({ filters, onChange, disabled }: Props) {
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      aria-label="Result filters"
    >
      <h2 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
        Filters
      </h2>
      <div className="flex flex-col gap-4">
        <fieldset className="space-y-1.5" disabled={disabled}>
          <legend className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Year
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="year-min">
              Minimum year
            </label>
            <input
              id="year-min"
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={filters.yearMin ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange(patch(filters, { yearMin: null }));
                  return;
                }
                const n = Number.parseInt(raw, 10);
                onChange(
                  patch(filters, {
                    yearMin: Number.isFinite(n) ? n : null,
                  }),
                );
              }}
              className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="text-zinc-400">–</span>
            <label className="sr-only" htmlFor="year-max">
              Maximum year
            </label>
            <input
              id="year-max"
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={filters.yearMax ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange(patch(filters, { yearMax: null }));
                  return;
                }
                const n = Number.parseInt(raw, 10);
                onChange(
                  patch(filters, {
                    yearMax: Number.isFinite(n) ? n : null,
                  }),
                );
              }}
              className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Min citations
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            disabled={disabled}
            value={filters.minCitations ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange(patch(filters, { minCitations: null }));
                return;
              }
              const n = Number.parseInt(raw, 10);
              onChange(
                patch(filters, {
                  minCitations: Number.isFinite(n)
                    ? Math.max(0, n)
                    : null,
                }),
              );
            }}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            disabled={disabled}
            checked={filters.openAccessOnly}
            onChange={(e) =>
              onChange(patch(filters, { openAccessOnly: e.target.checked }))
            }
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span className="text-zinc-800 dark:text-zinc-200">
            Open access only
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Venue type
          </span>
          <select
            disabled={disabled}
            value={filters.venueKind}
            onChange={(e) =>
              onChange(
                patch(filters, {
                  venueKind: e.target.value as VenueKindFilter,
                }),
              )
            }
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="any">Any</option>
            <option value="journal">Journal (heuristic)</option>
            <option value="conference">Conference (heuristic)</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <input
            type="checkbox"
            disabled={disabled}
            checked={filters.impactful}
            onChange={(e) =>
              onChange(patch(filters, { impactful: e.target.checked }))
            }
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span className="text-zinc-800 dark:text-zinc-200">
            Impactful order
            <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              Sort by citations (then year, title)
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
