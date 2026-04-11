# Project architecture (ScholarAI)

## Goals and principles

- **Personal tool first:** Optimize for a single operator’s research flow, not multi-tenant SaaS—unless the plan explicitly adds auth and isolation.
- **Truth from APIs:** Paper metadata comes from **Semantic Scholar**; do not fabricate citations or links.
- **Respect third-party terms:** Cache and rate limits must follow provider rules (see `data-sources.md`).
- **Scoped AI:** **v1:** Analyze (rank + synthesis) and chat were grounded in retrieved papers. **v1.1 (shipped):** No LLM **re-rank** in the UI; **AI-guided search** (`POST /api/ai/search-plan` → Semantic Scholar). **v1.2 (shipped):** **Research chat** is grounded in the **corpus cart** (papers added per card, `sessionStorage`, survives new searches). Avoid answering from unrelated training knowledge when the UX promises “these results.”
- **Progressive delivery:** Ship search UI before AI features; keep feature flags or toggles for AI mode.

## Main components (planned)

| Component | Responsibility |
|-----------|----------------|
| **Web UI (Next.js)** | Search, filters, result cards, AI toggles, chat panel, loading/error states. **v1.1:** Resizable **results \| chat** split; **literal** vs **AI search** mode. **v1.2 (shipped):** **Corpus cart** beside chat (`CorpusCartPanel`), **sessionStorage**, per-card **Add to corpus**, remove/clear; split visible when cart non-empty; loading/retry/reduced-motion polish. |
| **Search adapter** | Calls Semantic Scholar search; maps fields to internal **Paper** shape (`../data-model.md`). |
| **Filter / sort layer** | **Phase 2:** Client-side filtering and “Impactful” sort on the **accumulated** result list (all pages loaded via “Load more”). Semantic Scholar `paper/search` is unchanged except `offset`/`limit` for pagination. |
| **AI services** | **`POST /api/ai/search-plan`**, **`POST /api/ai/chat`**, **`POST /api/ai/analyze`** — all return **503 `LLM_DISABLED`** when env **`SCHOLARAI_LLM_DISABLED`** is truthy (`true` / `1` / `yes` / `on`). **`GET /api/site-config`** exposes `{ llmEnabled }` for the UI (no secrets). Otherwise: **Provider choice (v1.3):** `providerPreference` + `scholarai_llm_provider` session; default DeepSeek-first + Gemini fallback when both keys exist. |
| **API boundary** | **v1:** Next.js Route Handlers only (`web/src/app/api/...`). A separate FastAPI (or other) service is optional later—do not duplicate business logic across two stacks without reason. |

**App package:** Next.js (App Router) lives in **`web/`** (`web/src/app`). Env template names stay at repo root **`.env.example`**; local overrides for the app use **`web/.env.local`** (see `docs/agent/human-notes.md`).

## Data and storage

| Data | Approach |
|------|----------|
| Search results | Ephemeral per session or short TTL cache; refresh on new query or load-more. |
| User API keys | Environment / local secrets only; never committed (see `.env.example`). |
| RAG / chat index (Phase 4) | **Lexical retrieval:** abstracts+titles are split into in-memory `Chunk`s; top chunks are selected per user message via TF–IDF-style scoring over that set (no separate embedding API). The LLM receives only those excerpts plus chat history and must return JSON (`reply`, `citations` as paper ids, `outOfCorpus`). **v1.1:** Chunk/index only over the **user-confirmed corpus** (not the whole results list). **v1.2:** Corpus = **cart** — papers **added across multiple searches**; chat reads **cart snapshot** (deduped by `id`). |
| Accounts / DB | **None for v1** unless product scope changes—see `plan.md` open questions. |

## API and module boundaries

- **External:** Semantic Scholar Graph API `paper/search`; optional LLM HTTP APIs (DeepSeek, Gemini).
- **Internal:** A single **Paper** DTO consumed by list UI, filter pipeline, and AI prompts.
- **Server vs client:** Prefer keeping API keys **server-side** (Server Actions or FastAPI); never expose provider keys in the browser.
- **Phase 1 app API:** `GET /api/search?query=&limit=&offset=` (Next.js Route Handler in `web/src/app/api/search/route.ts`) returns JSON `{ papers, total?, error? }` and calls Semantic Scholar only from the server (`web/src/lib/semantic-scholar/search-papers.ts`).
- **Phase 5 app API:** `POST /api/ai/search-plan` (body `{ intent: string, providerPreference?: "deepseek" \| "gemini" }`) returns `{ queries, filtersPatch, rationale?, provider?, error? }`. Prompts in `build-search-plan-prompt.ts`; parsing in `parse-search-plan.ts`. Throttle channel `searchPlan` (`rate-limit.ts`).
- **Phase 3 app API (legacy):** `POST /api/ai/analyze` — same as before (`build-prompt.ts`, `parse-analysis.ts`); optional `curl` / experiments only.
- **Phase 4 app API:** `POST /api/ai/chat` (body `{ messages: [{ role, content }], papers: [{ id, title, abstract }], providerPreference?: "deepseek" \| "gemini" }`, max 80 papers and 24 turns; last turn must be `user`) returns JSON `{ reply, citations, outOfCorpus, provider?, error? }`. Chunking in `web/src/lib/ai/chunk-papers.ts`; retrieval in `web/src/lib/ai/retrieve-chunks.ts`; prompts in `web/src/lib/ai/build-chat-prompt.ts`; JSON parsing in `web/src/lib/ai/parse-chat-json.ts` (uses `parse-llm-json.ts` for fenced/extra prose). Per-IP throttle for chat is separate from analyze and search-plan (`AI_CHAT_RATE_LIMIT_MS` vs `AI_RATE_LIMIT_MS`).
- **Phase 2 UI state:** `SearchSection` keeps **accumulated papers** (deduped by `id`), **`paginationQuery`** (literal query or AI primary query for **Load more**), **next offset** for that query, optional **`total`** from Semantic Scholar when provided (must not be inferred from page size alone — see `issuesnotes.md`), and **`SearchResultFilters`**. Displayed rows = `applyFiltersAndSort` in `web/src/lib/result-filters.ts`. **Research chat** corpus: **v1.1** = **submitted** selection from current flow; **v1.2 (Phase 6)** = **corpus cart** (multi-search, remove/clear); chat history resets when **corpus id-set** changes.

## Phased delivery (architecture view)

1. **Phase 1:** Read-only search + cards; minimal state.
2. **Phase 2:** Filters + pagination/load-more; deterministic sort rules documented. **Impactful** order: `citationCount` descending, then `year` descending, then `title` (locale compare).
3. **Phase 3:** (Historical) Analyze route with scores + synthesis; **UI removed in v1.1** — no re-rank list or synthesis panel in `SearchSection`.
4. **Phase 4:** RAG chat with **citations** and **out-of-corpus** JSON path. **v1.1:** Chat corpus = **submitted** selection; **v1.2:** corpus = **cart**. Layout: **resizable** results \| chat (`ResizableSplit`); below `lg` stacks vertically; split also shows when the cart is non-empty so chat stays reachable without current results.

### v1.1 (Phase 5) — shipped

- **Layout:** `web/src/components/resizable-split.tsx` — drag handle and keyboard (`ArrowLeft`/`ArrowRight`); ratio in `sessionStorage` (`scholarai_results_chat_split`). Mobile/tablet: stacked columns (`lg:hidden` / `lg:flex`).
- **LLM JSON:** `parse-llm-json.ts` shared helper for markdown-wrapped or noisy JSON (chat + search plan).
- **Filters + pagination:** Single pipeline `applyFiltersAndSort` + `paginationQuery` / `inferHasMore`; Semantic Scholar `total` only when API returns it.

### v1.2 (Phase 6) — shipped

- **Corpus cart:** `CorpusCartPanel` + `corpus-cart-storage.ts` (`scholarai_corpus_cart`); **Add to corpus** on `PaperCard`; chat payload = cart; cart **not** cleared on new search.
- **LLM / UX:** Wrapped provider `fetch` errors; search **Retry** + AI **Planning…**; chat **Dismiss / Retry send**; route `error.tsx` for uncaught render errors; `motion-safe:animate-spin` and reduced-motion-friendly chat scroll.
- **More filters:** Deferred until Semantic Scholar fields are audited (`plan.md` **P6.5**).

### v1.3 (Phase 7) — shipped

- **LAN / network dev:** `npm run dev:lan` in **`web/`** runs `next dev --hostname 0.0.0.0`; **`human-notes.md`** documents the **Network** URL. **`web/next.config.ts`** sets **`allowedDevOrigins`** for common private LAN hosts so Next dev does not **403** `/_next` scripts when opened by IP (otherwise the shell loads but React never hydrates).
- **Chat:** Multi-turn thread (full history on each send); **Download** exports the session thread as Markdown (corpus ids + citation ids); no server-side chat persistence.
- **Model choice:** Home **LLM** segmented control + `sessionStorage` (`scholarai_llm_provider`); requests send `providerPreference` to **`/api/ai/search-plan`** and **`/api/ai/chat`**; server validates keys and returns **`PROVIDER_UNAVAILABLE`** when the choice cannot be satisfied. Omit `providerPreference` in API clients for legacy **DeepSeek-first** + Gemini fallback.

## Cross-cutting concerns

| Concern | Direction |
|---------|-----------|
| **Auth** | No per-user accounts in v1. **Optional** shared **access gate**: when `SCHOLARAI_ACCESS_CODE` and `ACCESS_GATE_SECRET` are both set (`web/.env.local` or host env), **middleware** requires a signed **httpOnly** cookie (see `human-notes.md`); omit either variable for a fully open deploy. |
| **Observability** | Structured logs for search and LLM calls (latency, error class); **no** raw API keys or full user prompts in logs if they contain secrets. AI analyze logs JSON lines: `op`, `durationMs`, `outcome`, `provider` (no prompt body). |
| **Compliance / ethics** | Respect Semantic Scholar and LLM provider ToS; surface attribution and links to originals. |
| **Security** | Validate LLM JSON before trusting citations or search-plan fields; model markdown rendered with `react-markdown` (no raw HTML plugin—reduces XSS from LLM output); SSRF protection if fetching URLs (PDF phase). **Resilience:** App Router `error.tsx` for soft recovery from client tree failures. |

When behavior or persistence changes, update **`pa.md`** and **`plan.md`** together.
