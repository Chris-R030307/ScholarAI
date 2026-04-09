# PaperParser / ScholarAI

Personal academic search and research assistant: Semantic Scholar–backed search, filters, optional LLM ranking and synthesis, and RAG-style chat over results. Product intent lives in **`docs/project summary.md`**.

**Repository:** [github.com/Chris-R030307/ScholarAI](https://github.com/Chris-R030307/ScholarAI) — clone with `git clone https://github.com/Chris-R030307/ScholarAI.git`.

## Monorepo layout

| Path | Purpose |
|------|---------|
| `web/` | **Next.js app** (App Router, Tailwind, Lucide)—run all `npm` commands here |
| `docs/project summary.md` | Human-written product summary (source of truth) |
| `docs/agent/` | **Contributor & AI hub** — read [`docs/agent/README.md`](docs/agent/README.md) first |
| `docs/data-model.md` | Paper and related entity index |
| `.cursor/rules/` | Cursor rules for project context, code, and communication |
| *(optional)* `backend/` | FastAPI service if not using Server Actions only |

## Quick start

```bash
cd web
cp ../.env.example .env.local   # optional until you need API keys; never commit
npm install
npm run dev
```

Open **http://localhost:3000** (or the URL printed in the terminal).

See **`docs/agent/human-notes.md`** for build, lint, and health checks.

## Environment

Variable **names** only — see **`.env.example`** at the repo root. Never commit secrets.

## Contributing (people and assistants)

1. Read **`docs/agent/README.md`** in listed order before substantive work.  
2. Follow phases in **`docs/agent/plan.md`**.  
3. Log tooling gotchas in **`docs/agent/issuesnotes.md`** (append-only, newest first).

## License

TBD — add when the project chooses a license.
