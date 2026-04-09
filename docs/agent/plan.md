# Delivery plan — ScholarAI (multi-agent checklist)

This file is the **step-by-step execution guide** for building ScholarAI. Product intent: [`../project summary.md`](../project%20summary.md). Architecture: [`pa.md`](./pa.md). Data contracts: [`../data-model.md`](../data-model.md).

**How to use this doc**

1. Read [`README.md`](./README.md) doc order once, then jump to **§ Project state snapshot** below.
2. Only work on steps whose **dependencies** are satisfied.
3. After completing work, **check the boxes** in your PR (or leave a short note in the PR description mapping to step IDs like `P1.3`).
4. Update **§ Project state snapshot** when a phase milestone lands (so the next agent knows the ground truth).
5. Log tooling/install/CI surprises in [`issuesnotes.md`](./issuesnotes.md) (append-only, newest first).
6. If you change API shapes, filters, or persistence, update **`pa.md`** and **`../data-model.md`** in the same change set.

---

## Sources of truth (do not drift)

| Topic | File |
|--------|------|
| Product / UX | `docs/project summary.md`, `docs/agent/projectsummary.md` |
| Architecture | `docs/agent/pa.md` |
| Paper / API shapes | `docs/data-model.md` |
| Env var names | repo root `.env.example`, `docs/agent/data-sources.md` |
| Run / test commands | `docs/agent/human-notes.md` (must stay accurate once code exists) |

---

## Human inputs (owner checklist)

Check these off as you provide them. Agents should **not** invent keys or accounts.

- [ ] **Repo access** — collaborators can clone and push (or fork workflow agreed). **Remote:** https://github.com/Chris-R030307/ScholarAI.git
- [ ] **`.env.local`** (or host secret store) — never committed; copy from `.env.example`.
  - [ ] `DEEPSEEK_API_KEY` — if Phase 3 uses DeepSeek.
  - [ ] `GEMINI_API_KEY` (or single chosen Google AI var per `.env.example`) — if Phase 3/4 uses Gemini.
  - [ ] `SEMANTIC_SCHOLAR_API_KEY` — optional until approved; improves rate limits when set.
- [x] **Backend choice** — **Next.js Route Handlers** for v1 (`pa.md`); FastAPI deferred unless product scope changes.
- [ ] **Deployment** (if not local-only) — where the app runs; where env vars are stored; custom domain if any.

---

## Project state snapshot (**update when milestones land**)

Replace the example row when the codebase advances. Next agent reads **only this table** to orient quickly.

| Item | Current state (edit me) |
|------|-------------------------|
| **App location** | `web/` — Next.js 16, App Router, `web/src/app` |
| **Phase completed** | **v1 ready** — P1–P4 + cross-cutting verified (2026-04-09) |
| **Git remote** | https://github.com/Chris-R030307/ScholarAI.git |
| **Branch / PR** | local / `main` (update when you open a PR) |
| **Blockers** | none |
| **Tests** | `cd web && npm test` (Vitest); `cd web && npm run lint` |
| **Last updated** | 2026-04-09 (v1 docs + snapshot) |

**Quick existence checks (tick when true)**

- [x] `package.json` exists and `npm run dev` starts the app.
- [x] Semantic Scholar search returns results in the UI (or mocked dev mode documented in `human-notes.md`).
- [x] `.env.example` lists every server-side secret **name** the code reads.

---

## Phase dependencies (order of work)

```text
P0 Bootstrap ──► P1 Search UI ──► P2 Filters + load more
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
                 P3 AI mode      (P4 needs P2        Cross-cutting
                 (can start       stable state;      docs/env/tests
                  after P1         P3 optional        anytime)
                  if behind
                  feature flag)
                                      │
                                      ▼
                                   P4 RAG chat
```

---

## P0 — Repository & app bootstrap

**Goal:** A runnable Next.js (App Router) app with Tailwind and Lucide, aligned with `pa.md`, keys read server-side only.

| Step ID | Dependency | Code / build | Validate | Human / info | Docs to update |
|---------|------------|--------------|----------|--------------|----------------|
| **P0.1** | — | Add Next.js app (subfolder e.g. `web/` **or** root if layout agreed), TypeScript, ESLint, Tailwind, `src/app` layout. | `npm install` succeeds; `npm run dev` serves a page; `npm run build` succeeds. | Decide **monorepo folder** for the app; record in snapshot table + root `README.md`. | `README.md`, `human-notes.md` (real commands, port). |
| **P0.2** | P0.1 | Add `.gitignore` entries for `.env.local`, `.env*.local`, `node_modules`, Next build output (if not already). | No secrets in `git status`. | — | `issuesnotes.md` if anything odd on your OS. |
| **P0.3** | P0.1 | Wire `lucide-react`; base layout (title, subtle ScholarAI shell). | Home page loads without console errors. | — | — |

**P0 checklist (granular)**

- [x] **P0.1** Next.js + TS + Tailwind + ESLint scaffold in chosen directory.
- [x] **P0.1** Root `README.md` points to app path and `docs/agent/` for contributors.
- [x] **P0.2** `.env.local` documented; never committed.
- [x] **P0.3** Lucide available; layout shell ready for search UI.

**P0 done when:** New clone can `cd <app>` → `npm run dev` → see UI shell; `human-notes.md` matches reality.

**Handoff:** Next agent starts **P1** using the same app directory.

---

## P1 — Basic Semantic Scholar search

**Goal:** Server-side search against Semantic Scholar; landing search bar; results as cards with required fields per `data-model.md` (`title`, `abstract`, `url`, `year`, `citationCount`, `isOpenAccess`, `authors`, `venue`).

| Step ID | Dependency | Code / build | Validate | Human / info | Docs to update |
|---------|------------|--------------|----------|--------------|----------------|
| **P1.1** | P0 | Implement `Paper` type + mapper from API → internal shape in one module (`data-model.md`). | Typecheck passes; mapper unit test or fixture test optional but ideal. | If API field names differ from assumptions, human confirms sample payload once. | `data-model.md` if fields change. |
| **P1.2** | P1.1 | Server-only client: `GET .../paper/search` with `query`, `limit` (default **20**), `offset`, `fields=...`. Send `x-api-key` when `SEMANTIC_SCHOLAR_API_KEY` is set. | With key: 200 + data; without key: acceptable behavior documented (200 or rate-limit) in `issuesnotes.md`. | Provide key when approved; until then expect stricter limits. | `data-sources.md` if base URL or headers change. |
| **P1.3** | P1.2 | Expose search via **Route Handler or Server Action** (no API keys in browser). Return stable JSON `{ papers, total?, error? }`. | `curl` or browser network tab shows JSON; errors are structured, not stack dumps. | — | `pa.md` boundary section if split client/server. |
| **P1.4** | P1.3 | UI: search input, submit, loading, empty state, error state. | Manual: empty query, long query, API failure (airplane mode or bad key). | — | — |
| **P1.5** | P1.4 | **PaperCard:** title, year, citations, OA badge, author snippet, link out; abstract truncated with expand optional. | Manual: 2–3 real queries look correct; links open. | Spot-check confusing venues/authors. | — |

**P1 checklist**

- [x] **P1.1** Single source of truth for `Paper` + mapping from Semantic Scholar.
- [x] **P1.2** Search client with `limit=20`, `offset`, optional API key header.
- [x] **P1.3** Server entrypoint for search; keys only on server.
- [x] **P1.4** Search UX with loading/error/empty.
- [x] **P1.5** Cards show all required fields from product summary.

**P1 done when:** End user can search and browse ~20 results with correct metadata and external links.

**Handoff:** Leave **state snapshot** filled (app path, P1 done). Next agent implements **P2** using the same `Paper` type and search endpoint (extend query params for filters/offset).

---

## P2 — Filters, load more, impactful ordering

**Goal:** Load more (pagination), sidebar filters (year, citations, OA, journal vs conference heuristic), **Impactful** mode favoring higher `citationCount` per product summary.

| Step ID | Dependency | Code / build | Validate | Human / info | Docs to update |
|---------|------------|--------------|----------|--------------|----------------|
| **P2.1** | P1 | **Load more:** increase `offset` by `limit`, append results (dedupe by `id`). | Manual: load more twice; no duplicate cards; spinner/disabled state OK. | — | — |
| **P2.2** | P1 | **Year min/max** filter (client or server—document in `pa.md`). | Manual: boundary years; empty result message. | — | — |
| **P2.3** | P1 | **Min citations** filter. | Manual: 0 vs high threshold. | — | — |
| **P2.4** | P1 | **Open access only** filter (`isOpenAccess`). | Manual: toggle on/off. | — | — |
| **P2.5** | P1 | **Journal vs conference:** implement heuristic; document rules in `data-model.md`. | Manual: mixed results; note false positives in `issuesnotes.md` if bad. | Human may judge sample rows for tuning. | `data-model.md` (venue heuristic). |
| **P2.6** | P2.* | **Impactful:** when on, sort/prioritize by `citationCount` (define stable tie-break e.g. year). | Unit test for sort OR manual checklist signed off. | — | `pa.md` if sort is server-side. |

**P2 checklist**

- [x] **P2.1** Load more + dedupe + UX feedback.
- [x] **P2.2** Year range filter.
- [x] **P2.3** Minimum citations filter.
- [x] **P2.4** Open access only.
- [x] **P2.5** Journal / conference heuristic **documented**.
- [x] **P2.6** Impactful ordering matches product intent.

**P2 done when:** Filters compose sensibly with loaded pages; behavior documented; no silent wrong filters.

**Handoff:** Expose a single in-memory or React **result list + filter state** that Phase 3/4 can consume (or document Zustand/context API in `pa.md`).

---

## P3 — AI mode (re-rank + synthesis)

**Goal:** Toggle (default **off**). When on: send top **~20** titles/abstracts to LLM for **relevance scores** and **synthesis** over top **10**; graceful degradation on errors/timeouts.

| Step ID | Dependency | Code / build | Validate | Human / info | Docs to update |
|---------|------------|--------------|----------|--------------|----------------|
| **P3.1** | P2 (P1 min) | UI toggle **AI mode**; disabled if no results; state visible to server calls. | Manual: toggle persists for session. | Keys in `.env.local` for chosen providers. | `human-notes.md` which keys are required for AI. |
| **P3.2** | P3.1 | Server route(s): build prompt from current result set; call **DeepSeek** and/or **Gemini** (decision in `pa.md`). Parse **structured JSON** (scores per `paperId`). | Fixture tests for parser; timeout + user-visible error. | Human: which model is **primary** for rank vs synthesis. | `data-sources.md` if new env vars. |
| **P3.3** | P3.2 | Re-rank UI: reorder list; show score or badge; tie-break documented. | Manual: compare order to baseline; no orphan ids. | — | — |
| **P3.4** | P3.2 | Synthesis panel: markdown or sections; must reference papers by title or id. | Manual: check hallucinated papers (should be none). | — | — |
| **P3.5** | P3.* | **Guards:** max tokens, throttle per session/IP if deployed, no logging of secrets/full prompts in prod logs. | Manual: double-submit; rapid toggles. | Monitor provider usage/billing. | `pa.md` observability. |

**P3 checklist**

- [x] **P3.1** AI mode toggle + wiring.
- [x] **P3.2** LLM integration server-side + robust JSON handling.
- [x] **P3.3** Re-ranked list + UX clarity.
- [x] **P3.4** Synthesis grounded in visible papers.
- [x] **P3.5** Cost/rate/logging safeguards.

**P3 done when:** AI mode is optional, correct when on, and safe when providers fail.

**Handoff:** Document prompt location and JSON schema in `pa.md` or `docs/agent/` snippet; Phase 4 reuses chunks/embeddings strategy.

---

## P4 — Research chat (RAG over current results)

**Goal:** Chat answers **only** from current retrieved set; citations to paper id/title; refusal when out of corpus.

| Step ID | Dependency | Code / build | Validate | Human / info | Docs to update |
|---------|------------|--------------|----------|--------------|----------------|
| **P4.1** | P2 | Chunk abstracts (and titles) per `data-model.md` `Chunk` shape. | Unit tests for chunk boundaries and `paperId` tags. | — | `data-model.md` if chunk rules change. |
| **P4.2** | P4.1 | Retrieval: embeddings + vector store **or** Gemini long-context stuffing for small sets—**pick one** and document in `pa.md`. | Canned questions: answer must cite correct paper. | Human: acceptable latency/cost. | `pa.md`, `issuesnotes.md` for provider quirks. |
| **P4.3** | P4.2 | Chat UI + history; assistant messages include **citations**. | Manual: 3–5 questions from `plan` / product summary example. | — | — |
| **P4.4** | P4.3 | Out-of-corpus questions get safe refusal or “not in these results.” | Manual: ask unrelated question. | — | — |

**P4 checklist**

- [x] **P4.1** Chunking pipeline with stable ids.
- [x] **P4.2** Retrieval path documented and tested.
- [x] **P4.3** Chat UI with citations.
- [x] **P4.4** Refusal / scope behavior.

**P4 done when:** Chat is grounded, citeable, and bounded to the result set.

---

## Cross-cutting (run throughout, verify before v1)

- [x] **Security** — Provider keys read only in Route Handlers (`web/src/app/api/**`); LLM responses validated in `parse-analysis.ts` / `parse-chat-json.ts` before UI use; synthesis and chat render markdown via `react-markdown` without raw HTML (default safe subset). See `pa.md` cross-cutting.
- [x] **`.env.example`** — Lists `SEMANTIC_SCHOLAR_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` (matches `process.env` usage under `web/src`); optional `NEXT_PUBLIC_APP_URL` commented.
- [x] **README + human-notes** — `web/` paths, port note, curl health checks, analyze + chat examples.
- [x] **Lint / tests** — `cd web && npm run lint` and `npm test` green (no GitHub Actions workflow yet; run locally before merge).
- [x] **issuesnotes** — 429, fonts/offline build, venue heuristic, chat vs analyze throttle, etc. (dated).
- [x] **pa ↔ plan** — Aligned on Next.js-only API surface for v1; RAG = lexical TF–IDF per `pa.md`.

---

## v1 (MVP) master checklist

- [x] **P1** complete (search + cards).
- [x] **P2** complete (load more + filters + impactful).
- [x] **P3** complete (AI toggle + re-rank + synthesis).
- [x] **P4** complete (RAG chat + citations + refusal).
- [x] Cross-cutting list above satisfied.
- [x] **Project state snapshot** reflects “v1 ready” and last updated date.

---

## Parallel work (multiple agents)

| Track | Safe after | Focus | Avoid |
|-------|------------|-------|--------|
| **UI** | P0 | Components, layout, a11y, loading states | Changing `Paper` fields without syncing `data-model.md` |
| **Data/API** | P0 | Semantic Scholar adapter, pagination, errors | Duplicating adapter logic in client |
| **AI** | P1 (flagged off) | Prompts, parsers, LLM clients | Shipping without server-only keys |

**Merge rule:** One agent owns **`Paper` / API JSON** changes per PR; others rebase immediately after merge.

---

## Open questions (resolve → move to `pa.md` or snapshot)

- **Deployment:** Local-only vs hosted (auth, secrets, CORS, rate limits) — decide when you ship beyond localhost.
- **Journal vs conference:** Heuristic limits; optional manual override later?
- **PDF pipeline:** Deferred past v1 unless explicitly scoped (Gemini PDF analysis).

**Resolved (see `pa.md` / `issuesnotes.md`):** v1 API surface is **Next.js Route Handlers only** (no FastAPI in this repo). Semantic Scholar with/without key and **429** behavior are documented in `data-sources.md` and `issuesnotes.md`. **RAG** for v1 is lexical TF–IDF over in-memory chunks per request.

When an item is **resolved**, add the decision to **`pa.md`** and tick or remove the bullet here.
