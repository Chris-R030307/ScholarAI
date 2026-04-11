# Issues notes (tooling)

Short, **append-only** log: **newest first**. No secrets, tokens, or key material.

---

## 2026-04-11

### 2026-04-11 — Administrator `SCHOLARAI_LLM_DISABLED` + `GET /api/site-config`

- **`SCHOLARAI_LLM_DISABLED`** (truthy string) turns off **`/api/ai/*`** and hides AI UI; **Semantic Scholar** search unchanged. **`human-notes.md`** § Administrator checklist.

### 2026-04-11 — Optional friends-only access gate

- **Env:** set **both** `SCHOLARAI_ACCESS_CODE` and `ACCESS_GATE_SECRET` in **`web/.env.local`** or the host (Vercel) to enable; omit either → site stays **open**.
- **Flow:** `middleware.ts` redirects unauthenticated users to **`/access`**; **`POST /api/auth/unlock`** checks the code (timing-safe compare), sets **httpOnly** JWT cookie (**jose**, ~30d), rate-limits bad guesses per IP.

### 2026-04-11 — LAN: `allowedDevOrigins` + no `useSearchParams` on home

- **Symptom:** Page loads over `http://<LAN-IP>:PORT` but **no buttons work** (React never runs).
- **Cause:** Next **dev** blocks `/_next/*` when the browser **Origin** host is not allowlisted (defaults favor `localhost`). Scripts get **403**; only HTML is visible.
- **Fix:** `web/next.config.ts` → **`allowedDevOrigins`** for common RFC1918-style host patterns; **restart** dev server. URL `?query=` bootstrap uses **`window.location`** once (no `useSearchParams` on the home `SearchSection`).

### 2026-04-11 — LAN search: `/?query=` full navigation + empty field

- **Symptom:** On `http://<LAN-IP>:PORT`, clicking **Search** turned the URL into **`/?query=…`** while the input went blank and no API search ran.
- **Cause:** The control was a native **GET** form with **`name="query"`**. If the client bundle did not run (or submit raced hydration), the browser performed a **document navigation** instead of `fetch`; React state stayed empty.
- **Fix:** Replaced the wrapper with **`role="search"`** (no GET submit), **`type="button"`** for the action, **Enter** handled in JS, and a one-time bootstrap from **`?query=`** via **`useSearchParams`** + **`router.replace`** (`search-section.tsx`, **`Suspense`** on the home page).

## 2026-04-10

### 2026-04-10 — Phase 6: corpus cart + LLM UX hardening

- **Cart:** Research chat corpus is no longer cleared on each new search; papers live in **`sessionStorage`** (`scholarai_corpus_cart`) with **Add to corpus** on cards (`corpus-cart-storage.ts`, `CorpusCartPanel`).
- **LLM:** Provider `fetch` calls wrap network failures with readable errors; chat keeps the typed message on failure and offers **Dismiss / Retry send**; search errors offer **Retry search**. Confirm **`web/.env.local`** + **`cd web && npm run dev`** if routes return `NO_PROVIDER`.

## 2026-04-09

### 2026-04-09 — Semantic Scholar `total` must stay optional for “load more”

- **Symptom:** When the API omitted `total`, the adapter used `papers.length` as `total`, so the UI thought the first full page was the entire result set and hid **Load more**.
- **Fix:** Return `total` only when the API includes it (`web/src/lib/semantic-scholar/search-papers.ts`). Aligns with **P5.7** in `plan.md`.

### 2026-04-09 — Doc layout: this repo vs older monorepo notes below

- **Current tree:** Single Next.js app under **`web/`** with **`npm`** — see root **`README.md`** and **`human-notes.md`**. Later entries in this file that mention **pnpm**, **`apps/web`**, or **`packages/db`** describe a different layout; ignore them if those paths do not exist in your clone.

### 2026-04-09 — AI chat uses a shorter per-IP cooldown than analyze

- **Behavior:** `POST /api/ai/chat` throttles successful completions with `AI_CHAT_RATE_LIMIT_MS` (default 4s). `POST /api/ai/analyze` still uses `AI_RATE_LIMIT_MS` (10s). Keys are namespaced internally (`chat:` vs `analyze:`) in `web/src/lib/ai/rate-limit.ts`.

### 2026-04-09 — `next build` can fail offline (Google Fonts / Geist)

- **Symptom:** Turbopack build errors fetching `Geist` / `Geist Mono` from `fonts.googleapis.com` when the machine has no network or fonts are blocked.
- **Mitigation:** Run `npm run build` with internet access, or switch `next/font/google` in `web/src/app/layout.tsx` to local/system fonts if you need fully offline builds.

### 2026-04-09 — Secrets belong in `web/.env.local`, not `.env.example`

- **Issue:** Real API keys were placed in repo root **`.env.example`** (tracked template). That file is for **names only** and may be committed or shared.
- **Fix:** Put values in **`web/.env.local`** (gitignored). If keys ever hit a remote or public channel, **rotate** them at each provider.

### 2026-04-09 — Journal vs conference filter is heuristic-only

- **Behavior:** Venue type **Journal** / **Conference** uses substring and acronym rules on the `venue` string (`web/src/lib/venue-kind.ts`). **Unknown** venues are hidden when a specific type is selected.
- **Expect:** False positives/negatives (e.g. unusual proceedings titles, “Science” in a conference name). Tune rules in code and `docs/data-model.md` if needed.

### 2026-04-09 — Semantic Scholar anonymous `429` on `paper/search`

- **Symptom:** `Too Many Requests` / HTTP 429 when calling `https://api.semanticscholar.org/graph/v1/paper/search` without an API key (or after brief anonymous use).
- **Mitigation:** Set **`SEMANTIC_SCHOLAR_API_KEY`** in **`web/.env.local`** (see root `.env.example` for the var name). The app sends **`x-api-key`** only from the server route; restart `npm run dev` after changing env.
- **Refs:** `web/src/lib/semantic-scholar/search-papers.ts`, `docs/agent/data-sources.md`.

- Initial doc scaffold: repository contained only `docs/project summary.md`; no `package.json` yet—install/run commands in `human-notes.md` are **forward-looking** until the app is scaffolded.

### 2026-04-09 — Next.js `next build` / SWC binary or cache EPERM

- **Symptom:** `Failed to load SWC binary for darwin/arm64` (optional `@next/swc-*` missing after a partial install), or `EPERM` creating `~/Library/Caches/next-swc` in a sandboxed environment.
- **Fix:** From **`web/`**, run **`npm install`** so platform optional dependencies resolve; run builds where the process can write Next’s SWC cache (or use an environment that supplies the native binary).
- **Refs:** `web/package.json`, `web/node_modules/next`.

### 2026-04-09 — drizzle-kit generate and NodeNext `.js` imports

- **Symptom:** `pnpm exec drizzle-kit generate` failed with `Cannot find module './enums.js'` when the schema was split across files using `import … from "./foo.js"` (correct for `tsc` + Node ESM).
- **Fix:** Keep **one** schema entry file for Drizzle kit: [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts) (`drizzle.config.ts` points here). Alternatively use a bundler/register toolchain; single file is simplest.
- **Refs:** `packages/db/drizzle.config.ts`.

### 2026-04-09 — npm workspaces install failed; pnpm is canonical

- **Symptom:** Root `npm install` (npm workspaces) failed with `Cannot read properties of null (reading 'matches')` — npm / lockfile edge case in this layout.
- **Fix:** Use **pnpm** (`packageManager` in root `package.json`, `pnpm-workspace.yaml`, `README`). After changing package managers or weird partial installs, **clean** then reinstall: `rm -rf node_modules apps/*/node_modules packages/*/node_modules` then `pnpm install`.
- **Refs:** root `README.md`, `pnpm-workspace.yaml`.

### 2026-04-09 — `pnpm --filter web start` and extra CLI args

- **Symptom:** `pnpm --filter web start -- -p 3010` passed arguments incorrectly; `next start` treated `-p` as a directory.
- **Fix:** Prefer **`PORT=3010 pnpm --filter web start`** (env var) instead of threading `-p` through pnpm filters unless the script is adjusted to forward args safely.
- **Refs:** `apps/web/package.json` `start` script.
