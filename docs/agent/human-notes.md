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

**Phone / LAN (Phase 7):** bind the dev server to all interfaces so other devices load the same-origin Next bundle (avoids “search becomes `/?query=…` full refresh” when JS never hydrates).

```bash
cd web
npm run dev:lan
```

Use the **Network:** URL printed in the terminal (e.g. `http://192.168.x.x:3000`) on the second device.

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

## Administrator checklist (you own the server)

Do these in **`web/.env.local`** (your Mac) or in **Vercel → Settings → Environment Variables** (production). **Redeploy or restart** `npm run dev` after every change.

### 1) Friends-only access (recommended for a public URL)

Add **both** lines (pick your own passphrase; generate the secret once):

```bash
cd web
# Append to .env.local — edit the first value; paste a new random hex for the second.
echo 'SCHOLARAI_ACCESS_CODE=your-long-shared-passphrase' >> .env.local
echo "ACCESS_GATE_SECRET=$(openssl rand -hex 32)" >> .env.local
```

Then restart the dev server or redeploy. Visitors must open **`/access`**, enter the code, then get a cookie for ~30 days. Remove **either** variable to open the site to the world again.

### 2) Turn off every LLM feature (search only)

Add or set:

`SCHOLARAI_LLM_DISABLED=true`

(Also accepts `1`, `yes`, `on`, case-insensitive.) **Semantic Scholar** search and filters still work; **AI search**, **research chat**, and **`/api/ai/analyze`** return **503** with `LLM_DISABLED`. Remove the variable or set to `false` to allow LLM again when keys are configured.

The home page reads **`GET /api/site-config`** (no secrets) to hide AI controls.

### 3) Deploy on the web

Follow **§ Deploy publicly (Vercel)** below. In step 5, add the same variables you use locally (including gate + `SCHOLARAI_LLM_DISABLED` if you use them).

---

## Deploy publicly (recommended: Vercel)

Yes — the app is a normal **Next.js** site in **`web/`**. The usual approach is **hosting + GitHub**, not exposing your home laptop to the internet.

### Why Vercel (or similar)

- Built for **Next.js** (same team): **server routes** (`/api/search`, `/api/ai/*`) run as **serverless functions** on their machines, not yours.
- You get a **public `https://…` URL** anyone can open (with the limits of your chosen plan).
- **`allowedDevOrigins`** in `web/next.config.ts` only matters for **`next dev`**; production builds do not use that LAN block.

### Steps (Vercel + GitHub)

1. Push this repo to **GitHub** (or use the existing remote you already have).
2. Sign up at **[vercel.com](https://vercel.com)** and **Add New… → Project**.
3. **Import** your GitHub repository.
4. **Critical:** set **Root Directory** to **`web`** (the folder that contains `package.json` for the Next app). If you skip this, the build will look at the repo root and fail.
5. **Environment variables** — in the project **Settings → Environment Variables**, add the same **names** as repo root **`.env.example`** (values are secrets; paste only in Vercel, never in git):
   - `SEMANTIC_SCHOLAR_API_KEY` — optional but helps rate limits for Semantic Scholar.
   - `DEEPSEEK_API_KEY` and/or `GEMINI_API_KEY` — needed for **AI search** and **research chat**; omit both and those features return “no provider” errors.
   - **Optional gate:** `SCHOLARAI_ACCESS_CODE` and `ACCESS_GATE_SECRET` — see **Optional friends-only access gate** below; omit both and the site stays open to anyone with the URL.
   - **Optional LLM kill-switch:** `SCHOLARAI_LLM_DISABLED` — set to `true` to turn off all LLM APIs and AI UI (see **§ Administrator checklist**).
6. **Deploy.** Vercel runs `npm install` and `npm run build` inside **`web/`**. After the first deploy, open the **Production** URL and try a search.

Optional: **Settings → Domains** to attach your own domain.

### If the live site shows `404 NOT_FOUND` (plain text) after setting Root Directory to `web`

That response is **Vercel’s platform** (header `x-vercel-error: NOT_FOUND`), not the ScholarAI UI — usually the host did **not** treat the folder as a **Next.js** app.

1. **Settings → General** → **Framework Preset** → set to **Next.js** (override “Other” if Vercel guessed wrong) → **Save**.
2. **Settings → Build and Deployment** → **Root Directory** = **`web`** → **Save**. Clear **Output Directory** if anything custom is set (leave empty for Next).
3. On **GitHub**, open the **same repo/branch** Vercel deploys and confirm **`web/package.json`** and **`web/src/app/page.tsx`** exist. If your Vercel project points at an **empty or old fork**, push your real code (this repo includes **`web/vercel.json`** to pin `nextjs` — commit and push it).
4. **Deployments** → **⋯** on the latest deployment → **Redeploy** → enable **“Clear build cache”** if offered.

### Costs and responsibility

- **Vercel:** has a **free tier** with fair-use limits; heavy traffic may need a paid plan — read [Vercel pricing](https://vercel.com/pricing).
- **Semantic Scholar / DeepSeek / Gemini:** usage and billing follow **each provider’s** rules; keys live in Vercel as **server-side** env vars (good). Anyone who can use the deployed site can trigger **your** API usage. Without the optional gate below, treat the URL as a **public kiosk**; with the gate, only people who know the **access code** get in (still one shared code, not per-user accounts).

### Optional friends-only access gate

When **both** of these are set in **`web/.env.local`** (local) or Vercel **Environment Variables** (production), the app is **private**:

| Variable | Purpose |
|----------|---------|
| `SCHOLARAI_ACCESS_CODE` | The **passphrase** you share with friends (pick something long enough to guess hard). |
| `ACCESS_GATE_SECRET` | A **long random server secret** used to sign the session cookie — **not** the same string as the access code. Generate once, e.g. `openssl rand -hex 32`. |

**Behavior:** Visitors hit `/` or any route → **redirect to `/access`** until they POST the correct code to **`/api/auth/unlock`**. Success sets an **httpOnly** cookie (about **30 days**). **All** pages and **all** `/api/*` routes (except `POST /api/auth/unlock`) require that cookie, so the API cannot be used without the gate.

**Omit either variable** (or leave empty) → gate is **off**; behavior matches older versions (open site).

**Limits:** One **shared** code for everyone you trust (not separate logins). Anyone who gets the code or a logged-in browser session can use your APIs. Wrong codes are **rate-limited** per IP on the unlock route.

**Implementation:** `web/src/middleware.ts`, `web/src/app/access/page.tsx`, `web/src/app/api/auth/unlock/route.ts`, `web/src/lib/access-gate.ts`.

### Other hosts

Anything that can run **`Node` + `next start`** (or a container image from `next build`) works in principle (Railway, Fly.io, a small VPS, etc.). You must set the same env vars on that host and run the app from **`web/`**.

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
  -d '{"intent":"papers about neural scaling laws for LLMs","providerPreference":"gemini"}'
```

Optional **`providerPreference`:** `"deepseek"` \| `"gemini"` — must match a configured key or the API returns `PROVIDER_UNAVAILABLE`. Omit the field to keep the server default (**DeepSeek first**, then Gemini on failure when both keys exist).

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
  -d '{"messages":[{"role":"user","content":"Which papers mention surveys?"}],"papers":[{"id":"PAPER_ID","title":"Example","abstract":"We conducted a survey of …"}],"providerPreference":"deepseek"}'
```

Optional **`providerPreference`:** same as search-plan. The UI stores the choice in **`sessionStorage`** key `scholarai_llm_provider` and sends it on each AI search and chat request.

Expect JSON with `reply` (markdown), `citations` (paper ids), and `outOfCorpus` (boolean), or `error`.

### Troubleshooting LLM routes (`NO_PROVIDER`, `PARSE_ERROR`, timeouts)

1. Confirm keys are in **`web/.env.local`** next to `web/package.json`, then **restart** `npm run dev` (Next.js only reads env at startup). Running `next dev` from the **repo root** without `cd web` may not load `web/.env.local` — prefer **`cd web && npm run dev`**.
2. **Model picker (v1.3):** the home page **LLM** control chooses DeepSeek vs Gemini for **AI search** and **research chat**. If you omit `providerPreference` in `curl`, the server still uses **DeepSeek first** with Gemini fallback when both keys exist. If you pass `providerPreference` explicitly, only that provider is used (no cross-fallback).
3. `PARSE_ERROR` often means the model returned non-JSON or invalid shape; use **Retry send** in the chat panel or **Retry search** after AI search; if it persists, check provider status and quotas.
4. Network or DNS failures surface as `LLM_ERROR` with “request failed” in the message; fix connectivity and retry.
5. For chat throttling, wait a few seconds between sends (`AI_CHAT_RATE_LIMIT_MS`). AI search plan uses a separate 10s cooldown after success (`searchPlan` channel in `rate-limit.ts`).

## Where AI prompts are built (monitoring / editing)

**AI search mode** is: user types a **vague natural-language intent** → `POST /api/ai/search-plan` → an LLM returns **structured JSON** (`queries`, optional `filtersPatch`, etc.) → the app runs **Semantic Scholar** with those queries. The instructions the model sees are assembled in the files below (edit there to change behavior).

| Feature | System / user prompt construction | Route handler |
|--------|-----------------------------------|---------------|
| **AI-guided search** | `web/src/lib/ai/build-search-plan-prompt.ts` (`searchPlanSystemPrompt`, etc.); intent string normalized in `normalize-search-plan-request.ts` | `web/src/app/api/ai/search-plan/route.ts` |
| **Research chat** | `web/src/lib/ai/build-chat-prompt.ts` (`chatSystemPrompt`, `buildChatUserPayload`); chunk text from `chunk-papers.ts` / `retrieve-chunks.ts` | `web/src/app/api/ai/chat/route.ts` |
| **Legacy analyze** (not main UI after v1.1) | `web/src/lib/ai/build-prompt.ts` | `web/src/app/api/ai/analyze/route.ts` |

**How to inspect what goes to the provider (dev):** set breakpoints or short-term logs in those routes (do **not** log secrets or full production prompts per `pa.md`); or use browser **Network** → request payload for `search-plan` / `chat` (user text only—corpus abstracts are large). Provider HTTP assembly lives in `web/src/lib/ai/providers.ts`.

## Dev server on LAN (phone / another machine)

If **`http://localhost:PORT`** works but **`http://<your-LAN-IP>:PORT`** loads the page yet **search only refreshes** (URL becomes `/?query=...`), the browser may be **submitting the HTML form without client JavaScript** (e.g. JS bundle not loaded from that host). Try:

1. From **`web/`**, run **`npm run dev:lan`** (same as `next dev --hostname 0.0.0.0`); open the **Network** URL Next prints on the phone.
2. On the phone, confirm **no** blocked requests to `/_next/...` (VPN, DNS, or corporate filter).

3. **Next.js dev cross-origin block (common “nothing clicks” on LAN):** From Next 15+, the dev server may return **403** for `/_next/*` when you open the app by **LAN IP** (e.g. `http://192.168.x.x:3000`) because the browser’s `Origin` host is not allowlisted. Symptom: the page shell looks fine but **buttons do nothing** (React never hydrates). This repo sets **`allowedDevOrigins`** in **`web/next.config.ts`** for typical **private IPv4** patterns (`10.*`, `192.168.*`, `172.*`). **Restart** `npm run dev` after changing that file. If you use another host (Tailscale, custom DNS, etc.), add a matching hostname pattern or exact host string there (see [Next.js `allowedDevOrigins`](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins)).

The main search control is a **`role="search"`** region (not a native `<form method="get">`), so the browser does not append **`?query=…`** on its own. If you still have old bookmarks with **`?query=`**, the app reads that once on load, fills the search box, and clears the param.

Document outcomes in **`issuesnotes.md`** if something non-obvious fixes it.

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
