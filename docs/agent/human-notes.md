# Human operator notes — ScholarAI

Plain-language steps for people running the project. **Never commit API keys**; use **`web/.env.local`** for Next.js overrides (or your shell environment).

## What this repo is

**ScholarAI** — Next.js UI in **`web/`** (see [`projectsummary.md`](./projectsummary.md)).

## Install

1. Install [Node.js](https://nodejs.org/) (LTS) and `npm`.
2. Clone the repository (canonical remote: **https://github.com/Chris-R030307/ScholarAI.git**).
3. From **`web/`**:

```bash
cd web
npm install
```

4. Optional — copy env **names** from the repo root template (fill values only when you need them):

```bash
cp ../.env.example .env.local
```

## Run (development)

```bash
cd web
npm run dev
```

**Phone or another device on your LAN:** If the page loads from `http://<your-lan-ip>:<port>/` but search “only refreshes” (URL shows `?query=…` and results never load), the browser may not be running the client bundle (failed `_next/static` loads, or submit before hydration). Bind on all interfaces and use the printed **Network** URL:

```bash
cd web
npx next dev -H 0.0.0.0
```

Then open the **Network** address shown in the terminal from the other device. If problems persist, check DevTools → **Network** for red entries under `_next/` or `/api/search`.

### Open the main page (home)

The landing UI lives at the app root **`/`** (implemented as `web/src/app/page.tsx`).

1. After `npm run dev`, find the line **Local:** in the terminal — that is the base URL (often **http://localhost:3000**). If port **3000** is already in use, Next.js picks the next free port (e.g. **3001**); always use the URL printed there.
2. Open that base URL in a browser (no path needed), or go explicitly to **`http://localhost:3000/`** if your dev server is on 3000.
3. **macOS shortcut:** with the dev server running, you can run `open http://localhost:3000/` (change the port to match the terminal if it is not 3000).

Default URL: **http://localhost:3000** (confirm in terminal if the port differs).

If a **FastAPI** backend is added later, typical pattern:

```bash
# example — adjust when pyproject/requirements exist
uvicorn main:app --reload --port 8000
```

Document the real module name and port here when added.

## Build and production smoke check

```bash
cd web
npm run build
npm run start
```

## Test and lint

- **Lint:** `cd web && npm run lint`
- **Unit tests:** `cd web && npm test` (Vitest; filter/sort helpers in `src/lib/*.test.ts`).
- **CI:** There is no GitHub Actions workflow in this repo yet; run lint and tests locally before pushing or opening a PR.

## Database migrations

**None planned for v1** unless the team adds accounts or persistent RAG storage. If migrations appear, document:

- Tool (e.g. Prisma, Alembic)
- Command to migrate up/down
- Where connection string lives (env var name only)

## Health checks

- **UI:** Open `/` — search bar, submit a query, result cards load (or structured error if rate-limited).
- **Semantic Scholar (API):** From the repo root (with dev server running on port 3000):

```bash
curl -sS "http://localhost:3000/api/search?query=machine%20learning&limit=2" | head -c 800
```

Expect JSON with `papers` (array) and optionally `total` (when the upstream API includes it — needed for correct **Load more** behavior). If you see `error` with rate-limit messaging, add `SEMANTIC_SCHOLAR_API_KEY` to `web/.env.local` and retry.

**AI search plan (Phase 5)** — requires `DEEPSEEK_API_KEY` and/or `GEMINI_API_KEY` in **`web/.env.local`** (not repo root `.env.local` — Next.js loads env from the `web/` directory when you run `npm run dev` there).

```bash
curl -sS -X POST "http://localhost:3000/api/ai/search-plan" \
  -H "Content-Type: application/json" \
  -d '{"intent":"papers about neural scaling laws for LLMs"}'
```

Expect JSON with `queries`, `filtersPatch`, optional `rationale`, and `provider`, or `error`. The home page **AI search** toggle calls this route before Semantic Scholar.

**AI analyze (Phase 3, optional)** — same keys; not used by the main UI after v1.1:

```bash
curl -sS -X POST "http://localhost:3000/api/ai/analyze" \
  -H "Content-Type: application/json" \
  -d '{"researchGoal":"machine learning","papers":[{"id":"PAPER_ID","title":"Example","abstract":"Short abstract."}]}'
```

**AI research chat (Phase 4 / v1.2)** — same LLM keys. The UI sends papers from your **corpus cart** (built with **Add to corpus** on each card; cart is stored in **`sessionStorage`** and survives new searches; up to 80 papers on the wire). Example:

```bash
curl -sS -X POST "http://localhost:3000/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Which papers mention surveys?"}],"papers":[{"id":"PAPER_ID","title":"Example","abstract":"We conducted a survey of …"}]}'
```

Expect JSON with `reply` (markdown), `citations` (paper ids), and `outOfCorpus` (boolean), or `error`.

### Troubleshooting LLM routes (`NO_PROVIDER`, `PARSE_ERROR`, timeouts)

1. Confirm keys are in **`web/.env.local`** next to `web/package.json`, then **restart** `npm run dev` (Next.js only reads env at startup). Running `next dev` from the **repo root** without `cd web` may not load `web/.env.local` — prefer **`cd web && npm run dev`**.
2. Prefer one working provider: set **`DEEPSEEK_API_KEY`** *or* **`GEMINI_API_KEY`**; the server tries DeepSeek first when both exist.
3. `PARSE_ERROR` often means the model returned non-JSON or invalid shape; use **Retry send** in the chat panel or **Retry search** after AI search; if it persists, check provider status and quotas.
4. Network or DNS failures surface as `LLM_ERROR` with “request failed” in the message; fix connectivity and retry.
5. For chat throttling, wait a few seconds between sends (`AI_CHAT_RATE_LIMIT_MS`). AI search plan uses a separate 10s cooldown after success (`searchPlan` channel in `rate-limit.ts`).

## LLM prompts (where to read or change them)

To **inspect or tune** what the app sends to DeepSeek / Gemini, edit the **server-only** modules under `web/src/lib/ai/`:

| Flow | Prompt builder | Notes |
|------|----------------|--------|
| **AI search mode** (NL → Scholar-style queries + optional filters) | `build-search-plan-prompt.ts` | Used by `POST /api/ai/search-plan` before Semantic Scholar runs. |
| **Research chat** (corpus-grounded Q&A) | `build-chat-prompt.ts` | Used by `POST /api/ai/chat` with retrieved chunks + message history. |
| **Analyze** (optional / not main UI) | `build-prompt.ts` | `POST /api/ai/analyze` for experiments or external callers. |

**Monitoring:** There is no separate “prompt dashboard.” Use these files, structured server logs (see `pa.md` — no full prompt text in production if it may contain secrets), or temporary dev-only logging you remove before merge. **Never commit API keys.**

## Where configuration lives

| Item | Location |
|------|----------|
| Env var names | Repo root `.env.example` |
| Local Next.js env | `web/.env.local` (gitignored) |
| API docs (external) | [`data-sources.md`](./data-sources.md) |
| Paper field list | [`../data-model.md`](../data-model.md) |
| Tooling gotchas | [`issuesnotes.md`](./issuesnotes.md) |

## Getting help

- Product scope: [`../project summary.md`](../project%20summary.md)
- Agent reading order: [`README.md`](./README.md)
