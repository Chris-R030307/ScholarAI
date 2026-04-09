# Data model — ScholarAI

Non-trivial shapes the app should share across UI, API adapters, and LLM layers. **No application database** is assumed for v1; this is a **contract index**.

## 1. External: Semantic Scholar → `Paper` (canonical app entity)

Populated from `paper/search` (and optional detail calls later). Field names below are **internal**; map from API response names in one adapter module.

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|--------|
| `id` | string | ✓ | Semantic Scholar paper id if returned; else stable hash of DOI/url for React keys. |
| `title` | string | ✓ | |
| `abstract` | string \| null | | Empty string normalized to null optional. |
| `url` | string \| null | | PDF or landing page from API. |
| `year` | number \| null | | |
| `citationCount` | number | ✓ | Default `0` if missing. |
| `isOpenAccess` | boolean | ✓ | Default `false` if missing. |
| `authors` | `Author[]` | ✓ | May be empty. |
| `venue` | string \| null | | Journal or conference name; heuristic for “journal vs conference” in Phase 2. |

### Venue kind (journal vs conference)

The API returns a single `venue` string. The app classifies it **heuristically** for filters (`venueKind` in filter state); there is no separate API field.

| Class | Rule (order matters) |
|-------|----------------------|
| **Conference** | Substring match (case-insensitive) for: `conference`, `proceedings`, `symposium`, `workshop`, `conf.`; **or** common venue acronyms/names such as ICML, NeurIPS, NIPS, ICLR, CVPR, ICCV, ECCV, EMNLP, ACL, NAACL, COLING, CHI, SIGGRAPH, AAAI, IJCAI, KDD, WWW, WSDM, RecSys, Interspeech, UIST, CSCW. |
| **Journal** | Else, match: `journal`, `transactions`, `letters`, `annals`, or whole-word `nature`, `science`, `cell`, `lancet`, `nejm`, `jama`. |
| **Unknown** | Else (including empty/null venue, arXiv-only strings without journal keywords, ambiguous titles). |

**Filter behavior:** When the user selects **Journal** or **Conference**, papers classified as **unknown** are **excluded** (only confident rows pass). **Any** shows all loaded papers.

Implementation: `web/src/lib/venue-kind.ts` (`classifyVenueKind`).

### `Author`

| Field | Type | Required |
|-------|------|----------|
| `name` | string | ✓ |
| `id` | string \| null | |

## 2. Search request (internal)

| Field | Type | Notes |
|-------|------|--------|
| `query` | string | User text. |
| `limit` | number | Default `20`; align with product summary. |
| `offset` | number | For load more. |

## 3. Filter state (UI / server)

| Field | Type | Notes |
|-------|------|--------|
| `yearMin` | number \| null | |
| `yearMax` | number \| null | |
| `minCitations` | number \| null | |
| `openAccessOnly` | boolean | |
| `impactful` | boolean | When true, prefer higher `citationCount` in ordering. |
| `venueKind` | `"any" \| "journal" \| "conference"` | Implementation-defined mapping from `venue` string. |

## 4. AI mode outputs (Phase 3)

| Artifact | Shape (logical) | Notes |
|----------|-----------------|--------|
| Re-rank | `Array<{ paperId: string, score: number, note?: string }>` | Legacy **`/api/ai/analyze`** only; main UI does not re-rank after v1.1. |
| Synthesis | string (markdown) or structured sections | Same legacy route; not shown on the home page after v1.1. |

## 5. RAG / chat (Phase 4)

| Entity | Purpose |
|--------|---------|
| `Chunk` | `{ paperId, text, chunkIndex }` — retrieval unit. |
| `ChatMessage` | `{ role: "user" \| "assistant", content: string, citations?: string[] }` — `citations` are paper ids or titles. |

### Chunking rules (implementation)

- Source text is **title** plus **abstract** (abstract may be null → title-only chunk).
- Target max chunk size **~720 characters** with **~72-character overlap** between abstract segments so boundaries do not drop context.
- Chunk `text` always includes a line `[paperId:<id>]` (and `Title:` on the first segment). Continuation segments include `(continued)` after the paper id line.
- `chunkIndex` is **0-based** per paper, stable in construction order.

### Retrieval (Phase 4)

- **Lexical scoring:** TF–IDF-style term scores over the in-memory chunk list for the current request (no embedding API). Top chunks are passed to the LLM with the conversation and corpus instructions (`docs/agent/pa.md`).

### Chat corpus (v1.1 / Phase 5)

- The **research chat** request body is still `{ messages, papers }`, but the UI only sends papers the user **checked** and **submitted** for chat — not the full filtered result list. Chat history resets when the submitted id-set changes.

## 6. Versioning

When adding fields, update this table and **`docs/agent/pa.md`** / **`plan.md`** if behavior changes.
