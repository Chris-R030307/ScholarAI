"use client";

import { AlertCircle, Loader2, Search, Sparkles } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiSynthesis } from "@/components/ai-synthesis";
import { ResearchChat } from "@/components/research-chat";
import { SearchFiltersPanel } from "@/components/search-filters-panel";
import { PaperCard } from "@/components/paper-card";
import type { AiAnalyzeResponse } from "@/lib/ai/types";
import { sortDisplayedByAiScores } from "@/lib/ai/sort-displayed";
import type { Paper, SearchApiResponse } from "@/lib/paper";
import {
  applyFiltersAndSort,
  defaultSearchResultFilters,
  type SearchResultFilters,
} from "@/lib/result-filters";

const PAGE_LIMIT = 20;

/** Stable AI cache key: goal + top corpus ids (order-insensitive). */
function aiSignatureFrom(researchGoal: string, paperIds: string[]): string {
  return `${researchGoal.trim()}::${[...paperIds].sort().join(",")}`;
}

function inferHasMore(params: {
  batchLen: number;
  limit: number;
  prevOffset: number;
  total?: number;
}): boolean {
  const { batchLen, limit, prevOffset, total } = params;
  if (batchLen === 0) return false;
  if (batchLen < limit) return false;
  if (total != null && prevOffset + batchLen >= total) return false;
  return true;
}

function mergeDedupe(prev: Paper[], batch: Paper[]): Paper[] {
  const ids = new Set(prev.map((p) => p.id));
  const out = [...prev];
  for (const p of batch) {
    if (!ids.has(p.id)) {
      ids.add(p.id);
      out.push(p);
    }
  }
  return out;
}

export function SearchSection() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const [accumulated, setAccumulated] = useState<Paper[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [total, setTotal] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchResultFilters>(() =>
    defaultSearchResultFilters(),
  );
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [moreAvailable, setMoreAvailable] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [aiOk, setAiOk] = useState<{
    signature: string;
    rankingById: Map<string, { score: number; note?: string }>;
    analyzedIds: Set<string>;
    synthesis: string;
    provider?: string;
  } | null>(null);

  const displayed = useMemo(
    () => applyFiltersAndSort(accumulated, filters),
    [accumulated, filters],
  );

  const researchGoal = useMemo(() => {
    const q = (completedQuery ?? trimmedQuery).trim();
    return q || "Academic search results";
  }, [completedQuery, trimmedQuery]);

  const top20ForAi = useMemo(() => displayed.slice(0, PAGE_LIMIT), [displayed]);

  const currentAiSignature = useMemo(
    () => aiSignatureFrom(researchGoal, top20ForAi.map((p) => p.id)),
    [researchGoal, top20ForAi],
  );

  const chatCorpusSignature = useMemo(
    () => [...displayed].map((p) => p.id).sort().join(","),
    [displayed],
  );

  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;

  const visiblePapers = useMemo(() => {
    if (
      !aiMode ||
      aiLoading ||
      !aiOk ||
      aiOk.signature !== currentAiSignature
    ) {
      return displayed;
    }
    return sortDisplayedByAiScores(
      displayed,
      aiOk.rankingById,
      aiOk.analyzedIds,
    );
  }, [
    aiMode,
    aiLoading,
    aiOk,
    currentAiSignature,
    displayed,
  ]);

  useEffect(() => {
    if (displayed.length === 0) setAiMode(false);
  }, [displayed.length]);

  useEffect(() => {
    if (!aiMode) {
      setAiLoading(false);
      setAiErr(null);
      setAiOk(null);
      return;
    }
    const papers = displayedRef.current.slice(0, PAGE_LIMIT);
    if (papers.length === 0) return;

    const sig = currentAiSignature;
    const ac = new AbortController();
    setAiLoading(true);
    setAiErr(null);

    void (async () => {
      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: ac.signal,
          body: JSON.stringify({
            researchGoal,
            papers: papers.map((p) => ({
              id: p.id,
              title: p.title,
              abstract: p.abstract,
            })),
          }),
        });
        const data = (await res.json()) as AiAnalyzeResponse;
        if (ac.signal.aborted) return;
        if (data.error) {
          setAiOk(null);
          setAiErr({
            message: data.error.message,
            code: data.error.code,
          });
          return;
        }
        const rankingById = new Map(
          data.rankings.map((r) => [
            r.paperId,
            { score: r.score, note: r.note },
          ]),
        );
        const analyzedIds = new Set(papers.map((p) => p.id));
        setAiOk({
          signature: sig,
          rankingById,
          analyzedIds,
          synthesis: data.synthesis,
          provider: data.provider,
        });
        setAiErr(null);
      } catch (e) {
        if (ac.signal.aborted) return;
        setAiOk(null);
        setAiErr({
          message:
            e instanceof Error
              ? e.message
              : "Could not run AI analysis. Try again.",
        });
      } finally {
        if (!ac.signal.aborted) setAiLoading(false);
      }
    })();

    return () => ac.abort();
  }, [aiMode, currentAiSignature, researchGoal]);

  const hasResults = accumulated.length > 0;
  const canLoadMore =
    hasResults && !loading && !loadingMore && moreAvailable;

  const fetchPage = useCallback(async (q: string, offset: number) => {
    const params = new URLSearchParams({
      query: q,
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });
    const res = await fetch(`/api/search?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = (await res.json()) as SearchApiResponse;
    return { res, data };
  }, []);

  const runSearch = useCallback(async () => {
    const q = trimmedQuery;
    setError(null);
    setErrorCode(null);
    if (!q) {
      setCompletedQuery(null);
      setMoreAvailable(false);
      setAccumulated([]);
      setNextOffset(0);
      setTotal(undefined);
      return;
    }
    setLoading(true);
    try {
      const { res, data } = await fetchPage(q, 0);
      if (!res.ok && data.error) {
        setCompletedQuery(q);
        setMoreAvailable(false);
        setAccumulated([]);
        setNextOffset(0);
        setTotal(undefined);
        setError(data.error.message);
        setErrorCode(data.error.code ?? null);
        return;
      }
      if (data.error) {
        setCompletedQuery(q);
        setMoreAvailable(false);
        setAccumulated([]);
        setNextOffset(0);
        setTotal(undefined);
        setError(data.error.message);
        setErrorCode(data.error.code ?? null);
        return;
      }
      setCompletedQuery(q);
      setAccumulated(mergeDedupe([], data.papers));
      setNextOffset(data.papers.length);
      setTotal(data.total);
      setMoreAvailable(
        inferHasMore({
          batchLen: data.papers.length,
          limit: PAGE_LIMIT,
          prevOffset: 0,
          total: data.total,
        }),
      );
    } catch {
      setCompletedQuery(q);
      setMoreAvailable(false);
      setAccumulated([]);
      setNextOffset(0);
      setTotal(undefined);
      setErrorCode(null);
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, trimmedQuery]);

  const loadMore = useCallback(async () => {
    if (!trimmedQuery || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    setError(null);
    setErrorCode(null);
    try {
      const { res, data } = await fetchPage(trimmedQuery, nextOffset);
      if (!res.ok && data.error) {
        setError(data.error.message);
        setErrorCode(data.error.code ?? null);
        return;
      }
      if (data.error) {
        setError(data.error.message);
        setErrorCode(data.error.code ?? null);
        return;
      }
      const prevOff = nextOffset;
      setAccumulated((prev) => mergeDedupe(prev, data.papers));
      setNextOffset((o) => o + data.papers.length);
      if (data.total !== undefined) setTotal(data.total);
      setMoreAvailable(
        inferHasMore({
          batchLen: data.papers.length,
          limit: PAGE_LIMIT,
          prevOffset: prevOff,
          total: data.total ?? total,
        }),
      );
    } catch {
      setErrorCode(null);
      setError("Could not load more. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [canLoadMore, fetchPage, loadingMore, nextOffset, total, trimmedQuery]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runSearch();
  }

  const noSearchHits =
    !loading &&
    !error &&
    trimmedQuery !== "" &&
    completedQuery === trimmedQuery &&
    accumulated.length === 0;
  const filteredEmpty =
    !loading &&
    !error &&
    hasResults &&
    displayed.length === 0;

  return (
    <div className="flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <form onSubmit={onSubmit} className="relative w-full max-w-2xl">
          <label htmlFor="paper-search" className="sr-only">
            Search papers
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            id="paper-search"
            type="search"
            name="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. diffusion models for text…"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-11 pr-24 text-sm text-zinc-900 shadow-sm outline-none ring-emerald-600/20 placeholder:text-zinc-400 focus:border-emerald-600/40 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Search
              </span>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="flex max-w-2xl gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-2">
              <p>{error}</p>
              {errorCode === "RATE_LIMIT" && (
                <p className="border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/60 dark:text-red-100/90">
                  <strong className="font-medium">Local fix:</strong> request a
                  free key from{" "}
                  <a
                    href="https://www.semanticscholar.org/product/api"
                    className="font-medium underline decoration-red-400 underline-offset-2 hover:decoration-red-600"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Semantic Scholar
                  </a>
                  , put{" "}
                  <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                    SEMANTIC_SCHOLAR_API_KEY
                  </code>{" "}
                  in{" "}
                  <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                    web/.env.local
                  </code>
                  , then restart{" "}
                  <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                    npm run dev
                  </code>
                  .
                </p>
              )}
            </div>
          </div>
        )}

        {noSearchHits && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No papers found for that query.
          </p>
        )}

        {filteredEmpty && (
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            No papers match your filters. Try widening the year range, lowering
            minimum citations, or setting venue type to Any.
          </p>
        )}

        {!loading && trimmedQuery === "" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter a topic or paper title to search Semantic Scholar.
          </p>
        )}

        {hasResults && (
          <div className="flex w-full flex-col gap-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              <p>
                Showing{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {displayed.length}
                </span>
                {displayed.length !== accumulated.length ? (
                  <>
                    {" "}
                    matches
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {" "}
                      ({accumulated.length} loaded
                      {total != null
                        ? ` of ${total.toLocaleString()} total`
                        : ""}
                      )
                    </span>
                  </>
                ) : total != null ? (
                  <>
                    {" "}
                    of {total.toLocaleString()} from search
                  </>
                ) : (
                  " papers"
                )}
              </p>
            </div>
            {aiMode && (
              <section
                aria-label="AI synthesis"
                className="rounded-xl border border-violet-200/90 bg-violet-50/60 p-4 dark:border-violet-900/55 dark:bg-violet-950/25"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-violet-950 dark:text-violet-100">
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  <span>Synthesis (top corpus)</span>
                  {aiOk?.signature === currentAiSignature && aiOk.provider && (
                    <span className="text-xs font-normal text-violet-800/80 dark:text-violet-200/80">
                      via {aiOk.provider}
                    </span>
                  )}
                </div>
                {aiLoading && (
                  <p className="flex items-center gap-2 text-sm text-violet-900/90 dark:text-violet-100/90">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Analyzing up to 20 visible results…
                  </p>
                )}
                {aiErr && !aiLoading && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                  >
                    {aiErr.message}
                    {aiErr.code === "NO_PROVIDER" && (
                      <p className="mt-2 border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/50 dark:text-red-100/90">
                        Add{" "}
                        <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                          DEEPSEEK_API_KEY
                        </code>{" "}
                        or{" "}
                        <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                          GEMINI_API_KEY
                        </code>{" "}
                        to{" "}
                        <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                          web/.env.local
                        </code>{" "}
                        and restart the dev server.
                      </p>
                    )}
                  </div>
                )}
                {!aiLoading &&
                  aiOk?.signature === currentAiSignature &&
                  !aiErr && (
                    <AiSynthesis markdown={aiOk.synthesis} />
                  )}
              </section>
            )}
            <ul className="flex flex-col gap-4">
              {visiblePapers.map((p) => (
                <li key={p.id}>
                  <PaperCard
                    paper={p}
                    aiMeta={
                      aiMode &&
                      aiOk?.signature === currentAiSignature &&
                      aiOk.analyzedIds.has(p.id)
                        ? aiOk.rankingById.get(p.id)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
            {canLoadMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="self-start rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading…
                  </span>
                ) : (
                  "Load more"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {hasResults && (
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-8 lg:w-60">
          <SearchFiltersPanel
            filters={filters}
            onChange={setFilters}
            disabled={loading}
          />
          <div
            className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
            aria-label="AI mode"
          >
            <h2 className="mb-3 flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <Sparkles
                className="size-4 text-violet-600 dark:text-violet-400"
                aria-hidden
              />
              AI mode
            </h2>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={aiMode}
                onChange={(e) => setAiMode(e.target.checked)}
                disabled={loading || displayed.length === 0}
                className="mt-0.5 size-4 rounded border-zinc-300 text-violet-700 focus:ring-violet-600 dark:border-zinc-600 dark:text-violet-500"
              />
              <span className="text-zinc-800 dark:text-zinc-200">
                Re-rank visible results and summarize themes across the top
                papers (uses titles/abstracts only; keys stay on the server).
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Tie-break: same AI score keeps filter/order baseline.
                </span>
              </span>
            </label>
          </div>
          {displayed.length > 0 && (
            <ResearchChat
              papers={displayed}
              corpusSignature={chatCorpusSignature}
              disabled={loading}
            />
          )}
        </aside>
      )}
    </div>
  );
}
