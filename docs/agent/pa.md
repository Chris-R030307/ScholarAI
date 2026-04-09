# Project architecture (ScholarAI)

## Goals and principles

- **Personal tool first:** Optimize for a single operator’s research flow, not multi-tenant SaaS—unless the plan explicitly adds auth and isolation.
- **Truth from APIs:** Paper metadata comes from **Semantic Scholar**; do not fabricate citations or links.
- **Respect third-party terms:** Cache and rate limits must follow provider rules (see `data-sources.md`).
- **Scoped AI:** Ranking, synthesis, and chat are grounded in **retrieved** papers; avoid answering from unrelated training knowledge when the UX promises “these results.”
- **Progressive delivery:** Ship search UI before AI features; keep feature flags or toggles for AI mode.

## Main components (planned)

| Component | Responsibility |
|-----------|----------------|
| **Web UI (Next.js)** | Search, filters, result cards, AI mode toggle, chat panel, loading/error states. |
| **Search adapter** | Calls Semantic Scholar search; maps fields to internal **Paper** shape (`../data-model.md`). |
| **Filter / sort layer** | **Phase 2:** Client-side filtering and “Impactful” sort on the **accumulated** result list (all pages loaded via “Load more”). Semantic Scholar `paper/search` is unchanged except `offset`/`limit` for pagination. |
| **AI services** | **Phase 3:** `POST /api/ai/analyze` — structured JSON (`rankings` per `paperId` + markdown `synthesis`). **Phase 4:** `POST /api/ai/chat` — RAG-style chat over the **currently displayed** papers (see below). **Provider order:** `DEEPSEEK_API_KEY` first; on failure or absence, `GEMINI_API_KEY` (model `gemini-2.0-flash`). |
| **API boundary** | **v1:** Next.js Route Handlers only (`web/src/app/api/...`). A separate FastAPI (or other) service is optional later—do not duplicate business logic across two stacks without reason. |

**App package:** Next.js (App Router) lives in **`web/`** (`web/src/app`). Env template names stay at repo root **`.env.example`**; local overrides for the app use **`web/.env.local`** (see `docs/agent/human-notes.md`).

## Data and storage

| Data | Approach |
|------|----------|
| Search results | Ephemeral per session or short TTL cache; refresh on new query or load-more. |
| User API keys | Environment / local secrets only; never committed (see `.env.example`). |
| RAG / chat index (Phase 4) | **Lexical retrieval:** abstracts+titles are split into in-memory `Chunk`s; top chunks are selected per user message via TF–IDF-style scoring over that set (no separate embedding API). The LLM receives only those excerpts plus chat history and must return JSON (`reply`, `citations` as paper ids, `outOfCorpus`). |
| Accounts / DB | **None for v1** unless product scope changes—see `plan.md` open questions. |

## API and module boundaries

- **External:** Semantic Scholar Graph API `paper/search`; optional LLM HTTP APIs (DeepSeek, Gemini).
- **Internal:** A single **Paper** DTO consumed by list UI, filter pipeline, and AI prompts.
- **Server vs client:** Prefer keeping API keys **server-side** (Server Actions or FastAPI); never expose provider keys in the browser.
- **Phase 1 app API:** `GET /api/search?query=&limit=&offset=` (Next.js Route Handler in `web/src/app/api/search/route.ts`) returns JSON `{ papers, total?, error? }` and calls Semantic Scholar only from the server (`web/src/lib/semantic-scholar/search-papers.ts`).
- **Phase 3 app API:** `POST /api/ai/analyze` (body `{ researchGoal, papers: [{ id, title, abstract }] }`, max 20 papers) returns JSON `{ rankings, synthesis, provider?, error? }`. Prompt text lives in `web/src/lib/ai/build-prompt.ts`; JSON parsing/validation in `web/src/lib/ai/parse-analysis.ts`. Client list state stays in `SearchSection` (toggle + signature keyed by sorted top-20 ids).
- **Phase 4 app API:** `POST /api/ai/chat` (body `{ messages: [{ role, content }], papers: [{ id, title, abstract }] }`, max 80 papers and 24 turns; last turn must be `user`) returns JSON `{ reply, citations, outOfCorpus, provider?, error? }`. Chunking in `web/src/lib/ai/chunk-papers.ts`; retrieval in `web/src/lib/ai/retrieve-chunks.ts`; prompts in `web/src/lib/ai/build-chat-prompt.ts`; JSON parsing in `web/src/lib/ai/parse-chat-json.ts`. Per-IP throttle for chat is separate from analyze (see `web/src/lib/ai/constants.ts` `AI_CHAT_RATE_LIMIT_MS`).
- **Phase 2 UI state:** `SearchSection` keeps **accumulated papers** (deduped by `id`), **pagination offset** for the next request, and **`SearchResultFilters`** (`yearMin`/`yearMax`, `minCitations`, `openAccessOnly`, `venueKind`, `impactful`). Displayed rows = `applyFiltersAndSort` in `web/src/lib/result-filters.ts`. **Research chat** uses the **displayed** list as corpus; history resets when the sorted-id signature of that list changes.

## Phased delivery (architecture view)

1. **Phase 1:** Read-only search + cards; minimal state.
2. **Phase 2:** Filters + pagination/load-more; deterministic sort rules documented. **Impactful** order: `citationCount` descending, then `year` descending, then `title` (locale compare).
3. **Phase 3:** AI mode behind toggle; structured LLM outputs (scores + summary) with validation and fallbacks. **AI re-rank tie-break:** same score → keep prior visible order (`applyFiltersAndSort`). **Analyzed corpus:** first 20 papers of the **filtered** list sent to the model; remaining rows keep baseline order below scored rows (`sortDisplayedByAiScores`).
4. **Phase 4:** RAG chat over the **filtered visible** corpus; assistant replies include **citations** (paper ids); **out-of-corpus** questions yield a safe refusal JSON path (`outOfCorpus: true`, empty citations).

## Cross-cutting concerns

| Concern | Direction |
|---------|-----------|
| **Auth** | Defer unless multi-user or cloud deployment requires it. |
| **Observability** | Structured logs for search and LLM calls (latency, error class); **no** raw API keys or full user prompts in logs if they contain secrets. AI analyze logs JSON lines: `op`, `durationMs`, `outcome`, `provider` (no prompt body). |
| **Compliance / ethics** | Respect Semantic Scholar and LLM provider ToS; surface attribution and links to originals. |
| **Security** | Validate LLM JSON before reordering or trusting citations; model markdown rendered with `react-markdown` (no raw HTML plugin—reduces XSS from LLM output); SSRF protection if fetching URLs (PDF phase). |

When behavior or persistence changes, update **`pa.md`** and **`plan.md`** together.
