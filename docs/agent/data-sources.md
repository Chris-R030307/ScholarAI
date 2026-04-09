# Data sources and external services

Env var **names** only; values live in `.env.local` or your secret store. See repo root `.env.example`.

## Semantic Scholar Graph API

| Item | Detail |
|------|--------|
| **Use** | Paper search and metadata (citations, abstract, venue, authors, OA flag). |
| **Search URL** | `https://api.semanticscholar.org/graph/v1/paper/search` |
| **Env** | `SEMANTIC_SCHOLAR_API_KEY` — optional for higher rate limits; anonymous usage may be allowed within limits. |
| **Fields to request** | Align with [`../data-model.md`](../data-model.md) / product summary: `title`, `abstract`, `url`, `year`, `citationCount`, `isOpenAccess`, `authors`, `venue`. |
| **Rate limits / terms** | Follow [Semantic Scholar API documentation](https://api.semanticscholar.org/api-docs/) and terms of use; cache responsibly; do not bulk-scrape beyond normal app use. |

## DeepSeek

| Item | Detail |
|------|--------|
| **Use** | AI-guided search plans, chat, and legacy analyze route (per `pa.md`). |
| **Env** | `DEEPSEEK_API_KEY` |
| **Reminders** | Keep keys server-side; log request ids and latency, not full prompts if they contain sensitive text. |

## Google Gemini

| Item | Detail |
|------|--------|
| **Use** | Long-context synthesis; optional PDF / document analysis later. |
| **Env** | `GEMINI_API_KEY` (or `GOOGLE_API_KEY` if you standardize on Google AI Studio—**pick one** in `.env.example` and stick to it). |
| **Reminders** | Obey [Google AI / Gemini terms](https://ai.google.dev/terms); mind quota and billing. |

## Internal AI route (Phase 5 — AI search plan)

| Item | Detail |
|------|--------|
| **URL** | `POST /api/ai/search-plan` (`web/src/app/api/ai/search-plan/route.ts`) |
| **Body** | `{ "intent": string }` — natural-language research goal; bounded length (`AI_SEARCH_PLAN_MAX_INTENT_CHARS` in `constants.ts`). |
| **Success JSON** | `{ "queries": string[], "filtersPatch": Partial<filter state>, "rationale"?: string, "provider": "deepseek" \| "gemini" }` — client merges `filtersPatch` into sidebar filters and runs Semantic Scholar for each query (first query drives pagination / load more). |
| **Errors** | Same shape as other AI routes with `queries: []`, `filtersPatch: {}`, and `error`. Throttle channel `searchPlan` (10s per IP after success). |

## Internal AI route (Phase 3 — analyze, optional / not used by main UI in v1.1)

| Item | Detail |
|------|--------|
| **URL** | `POST /api/ai/analyze` (Next.js Route Handler: `web/src/app/api/ai/analyze/route.ts`) |
| **Body** | `{ "researchGoal": string, "papers": [{ "id", "title", "abstract" }] }` — at most **20** papers; abstracts truncated server-side. |
| **Success JSON** | `{ "rankings": [{ "paperId", "score", "note?" }], "synthesis": string (markdown), "provider": "deepseek" \| "gemini" }` |
| **Errors** | `{ "error": { "code", "message" } }` with appropriate HTTP status (`400`, `429` throttle, `502`/`503`/`504`). |
| **Providers** | Prefer **DeepSeek** (`DEEPSEEK_API_KEY`); fallback **Gemini** (`GEMINI_API_KEY`, model `gemini-2.0-flash` in code). |

## Internal AI route (Phase 4 — research chat)

| Item | Detail |
|------|--------|
| **URL** | `POST /api/ai/chat` (Next.js Route Handler: `web/src/app/api/ai/chat/route.ts`) |
| **Body** | `{ "messages": [{ "role": "user" \| "assistant", "content": string }], "papers": [{ "id", "title", "abstract" }] }` — at most **80** papers, **24** turns; last message must be `user`. |
| **Success JSON** | `{ "reply": string (markdown), "citations": string[] (paper ids), "outOfCorpus": boolean, "provider"?: "deepseek" \| "gemini" }` |
| **Errors** | `{ "error": { "code", "message" } }` with `400`, `429` (per-IP throttle, separate cooldown from analyze), `502`/`503`/`504` as appropriate. |
| **Retrieval** | Lexical scoring over in-memory chunks from titles/abstracts (`chunk-papers.ts`, `retrieve-chunks.ts`); no embedding API in v1. |

## Internal DTO

Mapped **Paper** record for UI and LLM prompts is documented in [`../data-model.md`](../data-model.md).
