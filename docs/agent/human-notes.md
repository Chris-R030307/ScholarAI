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

Expect JSON with `papers` (array) and usually `total`. If you see `error` with rate-limit messaging, add `SEMANTIC_SCHOLAR_API_KEY` to `web/.env.local` and retry.

**AI analyze (Phase 3)** — requires `DEEPSEEK_API_KEY` and/or `GEMINI_API_KEY` in `web/.env.local` (see repo root `.env.example`). Example with dev server on port 3000 (replace `PAPER_ID` with a real id from a search response):

```bash
curl -sS -X POST "http://localhost:3000/api/ai/analyze" \
  -H "Content-Type: application/json" \
  -d '{"researchGoal":"machine learning","papers":[{"id":"PAPER_ID","title":"Example","abstract":"Short abstract."}]}'
```

Expect JSON with `rankings` and `synthesis`, or `error`. The UI **AI mode** toggle calls this route with up to 20 visible papers.

**AI research chat (Phase 4)** — same LLM keys as analyze. Example (ids/titles from a prior search):

```bash
curl -sS -X POST "http://localhost:3000/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Which papers mention surveys?"}],"papers":[{"id":"PAPER_ID","title":"Example","abstract":"We conducted a survey of …"}]}'
```

Expect JSON with `reply` (markdown), `citations` (paper ids), and `outOfCorpus` (boolean), or `error`. The sidebar **Research chat** uses the **filtered visible** list (up to 80 papers).

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
