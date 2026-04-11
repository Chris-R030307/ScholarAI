"use client";

import { AlertCircle, Loader2, Search, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CorpusCartPanel } from "@/components/corpus-cart-panel";
import { ResizableSplit } from "@/components/resizable-split";
import { ResearchChat } from "@/components/research-chat";
import { SearchFiltersPanel } from "@/components/search-filters-panel";
import { PaperCard } from "@/components/paper-card";
import type { AiSearchPlanResponse } from "@/lib/ai/types";
import {
  loadCorpusCartFromSession,
  saveCorpusCartToSession,
} from "@/lib/corpus-cart-storage";
import type { LlmProviderId } from "@/lib/llm-provider-preference";
import {
  loadLlmProviderFromSession,
  saveLlmProviderToSession,
} from "@/lib/llm-provider-preference";
import type { Paper, SearchApiResponse } from "@/lib/paper";
import {
  applyFiltersAndSort,
  defaultSearchResultFilters,
  type SearchResultFilters,
} from "@/lib/result-filters";

const PAGE_LIMIT = 20;

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

/** Human-readable summary of AI plan filter deltas for the review step. */
function filtersPatchSummary(
  patch: Partial<SearchResultFilters>,
): string | null {
  const parts: string[] = [];
  if (patch.yearMin !== undefined) {
    parts.push(
      patch.yearMin == null ? "Any minimum year" : `Year ≥ ${patch.yearMin}`,
    );
  }
  if (patch.yearMax !== undefined) {
    parts.push(
      patch.yearMax == null ? "Any maximum year" : `Year ≤ ${patch.yearMax}`,
    );
  }
  if (patch.minCitations !== undefined) {
    parts.push(
      patch.minCitations == null
        ? "Any citation count"
        : `≥ ${patch.minCitations} citations`,
    );
  }
  if (patch.openAccessOnly === true) parts.push("Open access only");
  if (patch.venueKind === "journal") parts.push("Venue: journals");
  if (patch.venueKind === "conference") parts.push("Venue: conferences");
  if (patch.impactful === true) parts.push("Impactful sort");
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

type PendingAiPlan = {
  intentSnapshot: string;
  queries: string[];
  filtersPatch: Partial<SearchResultFilters>;
  rationale?: string;
};

export function SearchSection() {
  const router = useRouter();
  const pathname = usePathname();
  const urlQueryBootstrapped = useRef(false);

  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const [accumulated, setAccumulated] = useState<Paper[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [total, setTotal] = useState<number | undefined>();
  const [paginationQuery, setPaginationQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [planningSearch, setPlanningSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchResultFilters>(() =>
    defaultSearchResultFilters(),
  );
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [moreAvailable, setMoreAvailable] = useState(false);
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [planRationale, setPlanRationale] = useState<string | null>(null);
  const [pendingAiPlan, setPendingAiPlan] = useState<PendingAiPlan | null>(
    null,
  );
  const [corpusCart, setCorpusCart] = useState<Paper[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProviderId>("deepseek");
  /** `null` = still loading from server; `false` = administrator turned off all LLM routes. */
  const [llmEnabledServer, setLlmEnabledServer] = useState<boolean | null>(null);
  const llmBlocked = llmEnabledServer === false;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/site-config", { credentials: "same-origin" })
      .then((r) => r.json() as Promise<{ llmEnabled?: boolean }>)
      .then((d) => {
        if (!cancelled) setLlmEnabledServer(d.llmEnabled !== false);
      })
      .catch(() => {
        if (!cancelled) setLlmEnabledServer(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!llmBlocked) return;
    setAiSearchMode(false);
    setPendingAiPlan(null);
    setPlanRationale(null);
    setPlanningSearch(false);
  }, [llmBlocked]);

  useEffect(() => {
    setCorpusCart(loadCorpusCartFromSession());
    setCartReady(true);
    const stored = loadLlmProviderFromSession();
    if (stored) setLlmProvider(stored);
  }, []);

  /** Recover from legacy `/?query=…` in the address bar (read once; avoids `useSearchParams` + Suspense). */
  useEffect(() => {
    if (urlQueryBootstrapped.current) return;
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("query")?.trim();
    if (!q) return;
    urlQueryBootstrapped.current = true;
    setQuery(q);
    router.replace(pathname || "/", { scroll: false });
  }, [pathname, router]);

  const selectLlmProvider = useCallback((id: LlmProviderId) => {
    setLlmProvider(id);
    saveLlmProviderToSession(id);
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    saveCorpusCartToSession(corpusCart);
  }, [corpusCart, cartReady]);

  useEffect(() => {
    if (
      pendingAiPlan &&
      trimmedQuery !== pendingAiPlan.intentSnapshot
    ) {
      setPendingAiPlan(null);
      setPlanRationale(null);
    }
  }, [trimmedQuery, pendingAiPlan]);

  const displayed = useMemo(
    () => applyFiltersAndSort(accumulated, filters),
    [accumulated, filters],
  );

  const chatCorpusSignature = useMemo(() => {
    if (corpusCart.length === 0) return "empty";
    return [...corpusCart].map((p) => p.id).sort().join(",");
  }, [corpusCart]);

  const hasResults = accumulated.length > 0;
  const canLoadMore =
    hasResults && !loading && !loadingMore && moreAvailable;
  const showChatColumn = hasResults || corpusCart.length > 0;

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

  const addToCorpus = useCallback((p: Paper) => {
    setCorpusCart((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }, []);

  const removeFromCorpus = useCallback((id: string) => {
    setCorpusCart((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearCorpus = useCallback(() => {
    setCorpusCart([]);
  }, []);

  const executeConfirmedAiSearch = useCallback(async () => {
    if (!pendingAiPlan) return;
    const queries = pendingAiPlan.queries.map((s) => s.trim()).filter(Boolean);
    if (queries.length === 0) {
      setError("Enter at least one non-empty query.");
      setErrorCode(null);
      return;
    }
    const intentLabel = pendingAiPlan.intentSnapshot;
    const { filtersPatch, rationale } = pendingAiPlan;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      setFilters((f) => ({ ...f, ...filtersPatch }));
      const primary = queries[0];
      setPaginationQuery(primary);

      let acc: Paper[] = [];
      let primaryLen = 0;
      let primaryTotal: number | undefined;

      for (let i = 0; i < queries.length; i++) {
        const { res, data } = await fetchPage(queries[i], 0);
        if (!res.ok && data.error) {
          setCompletedQuery(intentLabel);
          setMoreAvailable(false);
          setAccumulated([]);
          setNextOffset(0);
          setTotal(undefined);
          setError(data.error.message);
          setErrorCode(data.error.code ?? null);
          setPlanRationale(null);
          return;
        }
        if (data.error) {
          setCompletedQuery(intentLabel);
          setMoreAvailable(false);
          setAccumulated([]);
          setNextOffset(0);
          setTotal(undefined);
          setError(data.error.message);
          setErrorCode(data.error.code ?? null);
          setPlanRationale(null);
          return;
        }
        if (i === 0) {
          primaryLen = data.papers.length;
          primaryTotal = data.total;
        }
        acc = mergeDedupe(acc, data.papers);
      }

      setPendingAiPlan(null);
      setCompletedQuery(intentLabel);
      setAccumulated(acc);
      setNextOffset(primaryLen);
      setTotal(primaryTotal);
      setMoreAvailable(
        inferHasMore({
          batchLen: primaryLen,
          limit: PAGE_LIMIT,
          prevOffset: 0,
          total: primaryTotal,
        }),
      );
      setPlanRationale(rationale ?? null);
    } catch {
      setCompletedQuery(intentLabel);
      setMoreAvailable(false);
      setAccumulated([]);
      setNextOffset(0);
      setTotal(undefined);
      setPaginationQuery(null);
      setPlanRationale(null);
      setErrorCode(null);
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, pendingAiPlan]);

  const runSearch = useCallback(async () => {
    const q = trimmedQuery;
    setError(null);
    setErrorCode(null);
    if (aiSearchMode && llmEnabledServer === false) {
      setError(
        "AI search is turned off on this server. Semantic Scholar search still works — turn off “AI search”.",
      );
      setErrorCode("LLM_DISABLED");
      return;
    }
    if (!q) {
      setCompletedQuery(null);
      setMoreAvailable(false);
      setAccumulated([]);
      setNextOffset(0);
      setTotal(undefined);
      setPaginationQuery(null);
      setPlanRationale(null);
      setPendingAiPlan(null);
      return;
    }
    setLoading(true);
    setPlanningSearch(aiSearchMode);
    setPendingAiPlan(null);
    try {
      if (aiSearchMode) {
        const planRes = await fetch("/api/ai/search-plan", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: q,
            providerPreference: llmProvider,
          }),
        });
        setPlanningSearch(false);
        const plan = (await planRes.json()) as AiSearchPlanResponse;
        if (plan.error) {
          setCompletedQuery(q);
          setMoreAvailable(false);
          setAccumulated([]);
          setNextOffset(0);
          setTotal(undefined);
          setPaginationQuery(null);
          setPlanRationale(null);
          setError(plan.error.message);
          setErrorCode(plan.error.code ?? null);
          return;
        }

        setCompletedQuery(null);
        setAccumulated([]);
        setNextOffset(0);
        setTotal(undefined);
        setPaginationQuery(null);
        setMoreAvailable(false);
        setPlanRationale(plan.rationale ?? null);
        setPendingAiPlan({
          intentSnapshot: q,
          queries: [...plan.queries],
          filtersPatch: plan.filtersPatch,
          rationale: plan.rationale,
        });
        return;
      }

      setPlanRationale(null);
      const { res, data } = await fetchPage(q, 0);
      if (!res.ok && data.error) {
        setCompletedQuery(q);
        setMoreAvailable(false);
        setAccumulated([]);
        setNextOffset(0);
        setTotal(undefined);
        setPaginationQuery(null);
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
        setPaginationQuery(null);
        setError(data.error.message);
        setErrorCode(data.error.code ?? null);
        return;
      }
      setCompletedQuery(q);
      setAccumulated(mergeDedupe([], data.papers));
      setNextOffset(data.papers.length);
      setTotal(data.total);
      setPaginationQuery(q);
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
      setPaginationQuery(null);
      setPlanRationale(null);
      setErrorCode(null);
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
      setPlanningSearch(false);
    }
  }, [aiSearchMode, fetchPage, llmProvider, llmEnabledServer, trimmedQuery]);

  const loadMore = useCallback(async () => {
    const q = paginationQuery ?? trimmedQuery;
    if (!q || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    setError(null);
    setErrorCode(null);
    try {
      const { res, data } = await fetchPage(q, nextOffset);
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
  }, [canLoadMore, fetchPage, loadingMore, nextOffset, paginationQuery, total, trimmedQuery]);

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

  const searchBusyLabel = planningSearch ? "Planning…" : "Search";

  const leftColumn = (
    <div className="flex min-h-0 min-w-0 flex-col gap-6">
      {llmBlocked && (
        <p
          className="max-w-2xl rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <span className="font-medium">AI features are off</span> on this
          server (Semantic Scholar search still works). The owner can re-enable
          them by removing or changing{" "}
          <code className="rounded bg-amber-100/90 px-1 py-0.5 text-xs dark:bg-amber-900/50">
            SCHOLARAI_LLM_DISABLED
          </code>{" "}
          in the host environment.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={llmBlocked}
            title={
              llmBlocked
                ? "AI search is disabled by the administrator"
                : undefined
            }
            onClick={() => {
              if (llmBlocked) return;
              setAiSearchMode((v) => {
                if (v) {
                  setPendingAiPlan(null);
                  setPlanRationale(null);
                }
                return !v;
              });
            }}
            className={
              llmBlocked
                ? "inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-400 opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
                : aiSearchMode
                  ? "inline-flex items-center gap-1.5 rounded-full border border-violet-500 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-950 shadow-sm transition-colors duration-150 motion-reduce:transition-none dark:border-violet-500/70 dark:bg-violet-950/45 dark:text-violet-100"
                  : "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            AI search
          </button>
          {aiSearchMode && (
            <span className="text-xs text-violet-900/90 dark:text-violet-200/90">
              Vague questions → Scholar-style queries and optional filters.
            </span>
          )}
        </div>

        {!llmBlocked && (
          <div
            className="flex max-w-2xl flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
            role="group"
            aria-label="LLM provider for AI search and research chat"
          >
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              LLM
            </span>
            <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
              {(["deepseek", "gemini"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectLlmProvider(id)}
                  className={
                    llmProvider === id
                      ? "rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white dark:bg-emerald-600"
                      : "rounded-md px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }
                >
                  {id === "deepseek" ? "DeepSeek" : "Gemini"}
                </button>
              ))}
            </div>
            <span className="text-zinc-500 dark:text-zinc-400">
              Used for AI search plans and research chat (keys stay on the
              server).
            </span>
          </div>
        )}

        <div
          role="search"
          className={
            aiSearchMode
              ? "relative w-full max-w-2xl rounded-xl ring-2 ring-violet-400/55 transition-shadow duration-200 motion-reduce:transition-none dark:ring-violet-600/45"
              : "relative w-full max-w-2xl"
          }
        >
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder={
              aiSearchMode
                ? "e.g. papers about how habits form in the brain…"
                : "e.g. diffusion models for text…"
            }
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-11 pr-24 text-sm text-zinc-900 shadow-sm outline-none ring-emerald-600/20 placeholder:text-zinc-400 focus:border-emerald-600/40 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void runSearch()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-60 motion-reduce:transition-none dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden
                />
                {searchBusyLabel}
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>
      </div>

      {pendingAiPlan &&
        aiSearchMode &&
        trimmedQuery === pendingAiPlan.intentSnapshot && (
          <div
            className="max-w-2xl space-y-3 rounded-xl border border-violet-300/80 bg-violet-50/70 p-4 text-sm text-violet-950 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/35 dark:text-violet-100"
            role="region"
            aria-label="Review AI search plan"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium text-violet-950 dark:text-violet-50">
                Review Scholar queries
              </p>
              <button
                type="button"
                onClick={() => {
                  setPendingAiPlan(null);
                  setPlanRationale(null);
                }}
                className="shrink-0 rounded-md border border-violet-400/60 bg-white/90 px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100/80 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/60"
              >
                Cancel plan
              </button>
            </div>
            {planRationale && (
              <p className="text-violet-900/95 dark:text-violet-100/90">
                <span className="font-medium">Plan: </span>
                {planRationale}
              </p>
            )}
            {filtersPatchSummary(pendingAiPlan.filtersPatch) && (
              <p className="text-xs text-violet-900/85 dark:text-violet-200/85">
                <span className="font-medium">Filters: </span>
                {filtersPatchSummary(pendingAiPlan.filtersPatch)}
              </p>
            )}
            <ol className="list-decimal space-y-2 pl-5 marker:font-medium">
              {pendingAiPlan.queries.map((line, i) => (
                <li key={i} className="pl-1">
                  <label
                    htmlFor={`ai-pending-query-${i}`}
                    className="sr-only"
                  >
                    Scholar query {i + 1}
                  </label>
                  <input
                    id={`ai-pending-query-${i}`}
                    type="text"
                    value={line}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPendingAiPlan((prev) =>
                        prev
                          ? {
                              ...prev,
                              queries: prev.queries.map((q, j) =>
                                j === i ? v : q,
                              ),
                            }
                          : null,
                      );
                    }}
                    className="mt-0.5 w-full rounded-md border border-violet-200/90 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm outline-none ring-violet-500/20 focus:border-violet-500/50 focus:ring-2 dark:border-violet-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void executeConfirmedAiSearch()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-violet-800 disabled:opacity-60 motion-reduce:transition-none dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              {loading ? (
                <>
                  <Loader2
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden
                  />
                  Searching…
                </>
              ) : (
                "Run search"
              )}
            </button>
          </div>
        )}

      {planRationale && aiSearchMode && completedQuery === trimmedQuery && (
        <p
          className="max-w-2xl rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100"
          role="status"
        >
          <span className="font-medium">Plan: </span>
          {planRationale}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex max-w-2xl gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-2">
            <p>{error}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={loading || trimmedQuery === ""}
                className="rounded-md border border-red-300/80 bg-white px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/50"
              >
                Retry search
              </button>
            </div>
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
            {(errorCode === "NO_PROVIDER" || errorCode === "LLM_ERROR") && (
              <p className="border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/50 dark:text-red-100/90">
                For AI features, add{" "}
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
                (repo root{" "}
                <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                  .env.local
                </code>{" "}
                is ignored — use the file inside{" "}
                <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                  web/
                </code>
                ), then restart the dev server. See{" "}
                <code className="rounded bg-red-100/80 px-1 py-0.5 text-xs dark:bg-red-900/50">
                  docs/agent/human-notes.md
                </code>
                .
              </p>
            )}
          </div>
        </div>
      )}

      {!hasResults && corpusCart.length > 0 && (
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          You have papers in your corpus (right). Run a search here to browse
          more titles and add them with{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Add to corpus
          </span>
          .
        </p>
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
        <div className="flex min-h-0 w-full flex-col gap-4">
          <SearchFiltersPanel
            filters={filters}
            onChange={setFilters}
            disabled={loading}
          />

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

          <ul className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4">
            {displayed.map((p) => (
              <li key={p.id}>
                <PaperCard
                  paper={p}
                  corpus={{
                    inCorpus: corpusCart.some((c) => c.id === p.id),
                    onAdd: () => addToCorpus(p),
                    disabled: loading,
                  }}
                />
              </li>
            ))}
          </ul>

          {canLoadMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="self-start rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors duration-150 hover:bg-zinc-50 disabled:opacity-60 motion-reduce:transition-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden
                  />
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
  );

  const rightColumn = (
    <div className="flex min-h-0 flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <CorpusCartPanel
        papers={corpusCart}
        onRemove={removeFromCorpus}
        onClear={clearCorpus}
        disabled={loading}
      />
      <ResearchChat
        corpusPapers={corpusCart}
        corpusSignature={chatCorpusSignature}
        llmProvider={llmProvider}
        adminLlmOff={llmBlocked}
        disabled={loading || llmBlocked}
      />
    </div>
  );

  if (!showChatColumn) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col">{leftColumn}</div>
    );
  }

  return (
    <ResizableSplit
      storageKey="scholarai_results_chat_split"
      defaultLeftPercent={56}
      minLeftPercent={30}
      maxLeftPercent={75}
      left={leftColumn}
      right={rightColumn}
      className="w-full"
    />
  );
}
