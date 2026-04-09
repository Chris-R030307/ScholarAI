# Agent documentation hub

Assistants should read these files **in this order** before substantive design or implementation work. The canonical product intent lives in the project summary; `projectsummary.md` here aligns with it for quick scanning.

| Order | File | Purpose |
|------:|------|---------|
| 1 | [projectsummary.md](./projectsummary.md) | Product vision, user journey, flagship features. |
| 2 | [pa.md](./pa.md) | Architecture: principles, components, boundaries, phases, cross-cutting concerns. |
| 3 | [plan.md](./plan.md) | Phased checklist (build / verify / human), dependencies, v1 definition of done, contributor split. |
| 4 | [human-notes.md](./human-notes.md) | Install, run, test, migrations, health checks, where URLs and keys are configured (no secrets). |
| 5 | [issuesnotes.md](./issuesnotes.md) | Append-only tooling gotchas (newest first). |
| 6 | [data-sources.md](./data-sources.md) | External APIs, env var names, rate limits / terms reminders. |
| 7 | [../data-model.md](../data-model.md) | Entities and API shapes (schema index, not prose-only). |

**Human-written source:** [`../project summary.md`](../project%20summary.md) — if `projectsummary.md` and this diverge, reconcile with the summary as truth.

**Contributors:** See the root [README.md](../../README.md) for repo layout and commands once the app exists.
