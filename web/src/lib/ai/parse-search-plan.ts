import { parseLlmJsonObject } from "@/lib/ai/parse-llm-json";
import type { SearchResultFilters, VenueKindFilter } from "@/lib/result-filters";

export type AiSearchPlanParsed = {
  queries: string[];
  filtersPatch: Partial<SearchResultFilters>;
  rationale?: string;
};

export type ParseSearchPlanResult =
  | { ok: true; value: AiSearchPlanParsed }
  | { ok: false; message: string };

const MAX_QUERIES = 3;
const MAX_QUERY_LEN = 280;

function asVenueKind(v: unknown): VenueKindFilter | undefined {
  if (v === "any" || v === "journal" || v === "conference") return v;
  return undefined;
}

function clampInt(n: unknown, min: number, max: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * Validates LLM JSON for AI-guided search (Phase 5).
 */
export function parseSearchPlanJson(raw: string): ParseSearchPlanResult {
  const data = parseLlmJsonObject(raw);
  if (data === null) {
    return { ok: false, message: "Model returned invalid JSON." };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, message: "Model JSON must be an object." };
  }
  const o = data as Record<string, unknown>;

  const queriesRaw = o.queries;
  if (!Array.isArray(queriesRaw) || queriesRaw.length === 0) {
    return { ok: false, message: 'Model JSON must include non-empty "queries" array.' };
  }
  const queries: string[] = [];
  for (const q of queriesRaw) {
    if (typeof q !== "string") continue;
    const t = q.trim();
    if (!t) continue;
    queries.push(t.slice(0, MAX_QUERY_LEN));
    if (queries.length >= MAX_QUERIES) break;
  }
  if (queries.length === 0) {
    return { ok: false, message: "No usable search strings in queries." };
  }

  const filtersPatch: Partial<SearchResultFilters> = {};

  const ym = o.yearMin;
  if (ym === null) filtersPatch.yearMin = null;
  else {
    const y = clampInt(ym, 1900, 2100);
    if (y != null) filtersPatch.yearMin = y;
  }

  const yx = o.yearMax;
  if (yx === null) filtersPatch.yearMax = null;
  else {
    const y = clampInt(yx, 1900, 2100);
    if (y != null) filtersPatch.yearMax = y;
  }

  const mc = o.minCitations;
  if (mc === null) filtersPatch.minCitations = null;
  else {
    const c = clampInt(mc, 0, 1_000_000);
    if (c != null) filtersPatch.minCitations = c;
  }

  if (typeof o.openAccessOnly === "boolean") {
    filtersPatch.openAccessOnly = o.openAccessOnly;
  }

  const vk = asVenueKind(o.venueKind);
  if (vk) filtersPatch.venueKind = vk;

  if (typeof o.useImpactfulSort === "boolean") {
    filtersPatch.impactful = o.useImpactfulSort;
  } else if (typeof o.impactful === "boolean") {
    filtersPatch.impactful = o.impactful;
  }

  let rationale: string | undefined;
  if (typeof o.rationale === "string" && o.rationale.trim() !== "") {
    rationale = o.rationale.trim().slice(0, 500);
  }

  return {
    ok: true,
    value: { queries, filtersPatch, rationale },
  };
}
