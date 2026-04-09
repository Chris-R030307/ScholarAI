import type { Paper } from "@/lib/paper";
import { mapSemanticScholarPaper } from "@/lib/semantic-scholar/map-from-api";
import type { S2SearchResponse } from "@/lib/semantic-scholar/api-paper";

const BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/search";

/** Fields requested — align with docs/data-model.md paper card. */
export const S2_SEARCH_FIELDS = [
  "paperId",
  "title",
  "abstract",
  "url",
  "year",
  "citationCount",
  "isOpenAccess",
  "authors",
  "venue",
  "openAccessPdf",
].join(",");

const DEFAULT_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 20_000;

export type SearchPapersResult =
  | { ok: true; papers: Paper[]; total: number }
  | { ok: false; status: number; code: string; message: string };

function logSearchOutcome(input: {
  ms: number;
  ok: boolean;
  status?: number;
  code?: string;
  resultCount?: number;
  total?: number;
}) {
  const payload = {
    op: "semantic_scholar_search",
    durationMs: Math.round(input.ms),
    ok: input.ok,
    ...(input.status !== undefined && { httpStatus: input.status }),
    ...(input.code !== undefined && { errorCode: input.code }),
    ...(input.resultCount !== undefined && { resultCount: input.resultCount }),
    ...(input.total !== undefined && { total: input.total }),
  };
  console.info(JSON.stringify(payload));
}

export async function searchSemanticScholarPapers(params: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SearchPapersResult> {
  const q = params.query.trim();
  if (!q) {
    return { ok: true, papers: [], total: 0 };
  }

  const limit = Math.min(
    100,
    Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT)),
  );
  const offset = Math.max(0, Math.floor(params.offset ?? 0));

  const url = new URL(BASE_URL);
  url.searchParams.set("query", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("fields", S2_SEARCH_FIELDS);

  const headers: HeadersInit = { Accept: "application/json" };
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  if (key) headers["x-api-key"] = key;

  const started = performance.now();
  let res: Response;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(url.toString(), { headers, signal: ac.signal });
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    const ms = performance.now() - started;
    const message =
      e instanceof Error && e.name === "AbortError"
        ? "Search request timed out."
        : "Could not reach Semantic Scholar.";
    logSearchOutcome({ ms, ok: false, code: "NETWORK", status: 0 });
    return { ok: false, status: 0, code: "NETWORK", message };
  }

  const ms = performance.now() - started;
  const status = res.status;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    logSearchOutcome({ ms, ok: false, status, code: "INVALID_JSON" });
    return {
      ok: false,
      status,
      code: "INVALID_JSON",
      message: "Unexpected response from Semantic Scholar.",
    };
  }

  const parsed = body as S2SearchResponse;

  if (!res.ok) {
    const code =
      status === 429
        ? "RATE_LIMIT"
        : (parsed.code ??
          (status >= 500 ? "UPSTREAM" : "REQUEST"));
    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : status === 429
          ? "Rate limited. Try again shortly or set SEMANTIC_SCHOLAR_API_KEY in web/.env.local."
          : "Search failed.";
    logSearchOutcome({ ms, ok: false, status, code });
    return { ok: false, status, code, message };
  }

  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  const papers = rows.map(mapSemanticScholarPaper);
  const total =
    typeof parsed.total === "number" && Number.isFinite(parsed.total)
      ? Math.max(0, Math.floor(parsed.total))
      : papers.length;

  logSearchOutcome({
    ms,
    ok: true,
    status,
    resultCount: papers.length,
    total,
  });

  return { ok: true, papers, total };
}
