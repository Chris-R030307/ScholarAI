# ScholarAI — product summary (agent)

## Vision

ScholarAI is a **personal** academic search engine and research assistant. It replaces ad-hoc Google Scholar-style workflows using **open academic APIs** and **LLMs** (DeepSeek / Gemini), aiming for semantic understanding, ranking, and synthesis—not only keyword matching.

## User journey (target)

1. Land on a page with a **search bar**.
2. Enter a research query; see **up to 20 papers** first, with **Load more** for additional batches.
3. Refine with **filters**: impact (citations), recency (year), depth (venue type such as journal vs conference, open access).
4. Optionally enable **AI mode**:
   - **Relevance ranking:** LLM re-ranks results for a stated research goal.
   - **Synthesis:** A briefing across themes in the **top 10** hits.
5. Use **research chat** to ask questions **only about the current result set** (RAG-style grounding).

## Flagship features

| Feature | Behavior |
|---------|----------|
| Semantic search | Query-driven retrieval from Semantic Scholar (see `data-sources.md`). |
| Smart retrieval | Initial page size **20**; explicit **load more**. |
| Filters | Citations, year, journal vs conference, open access. |
| AI mode | Toggle; ranking + synthesis over titles/abstracts (and later PDF context if added). |
| Research chat | Scoped Q&A over retrieved papers. |

## Data the product cares about (paper card)

At minimum: **title**, **abstract**, **url**, **year**, **citationCount**, **isOpenAccess**, **authors**, **venue**. When **Impactful** filter is on, **prefer higher citation counts** in ordering or emphasis.

## Tech direction (implementation)

- **App:** Next.js (App Router), Tailwind, Lucide — app in `web/`.
- **APIs:** Server-only Route Handlers for search and AI (`pa.md`); no separate backend service in v1.
- **LLMs:** DeepSeek (primary); Gemini fallback (`data-sources.md`).

This file tracks **intent**; implementation details live in `pa.md` and `plan.md`.
