# ScholarAI — Project Summary

## Project Overview

ScholarAI is a personal academic search engine and research assistant. It serves as a replacement for Google Scholar by utilizing open academic APIs and LLMs (DeepSeek / Gemini). The goal is to move beyond simple keyword matching to semantic understanding, ranking, and synthesis of research papers.

## Core Features

### Semantic Search

A search bar on the landing page that fetches academic papers based on user queries.

### Smart Retrieval

- Initially fetches **20 papers** from the Semantic Scholar API.
- **Load More** for additional results.

### Filtering System

| Dimension | Purpose |
|-----------|---------|
| **Impact** | Filter by citation count. |
| **Recency** | Filter by publication year. |
| **Depth** | Filter by paper type (journal vs. conference) or open-access availability. |

### AI Mode (Toggle)

- **Relevance ranking:** Use DeepSeek or Gemini to re-rank search results against a specific research goal.
- **Synthesis summary:** A generated briefing that connects themes across the **top 10** results.

### Research Chat

A chat interface for questions scoped to the **currently retrieved** search results.

## Tech Stack

| Layer | Choice |
|-------|--------|
| **Frontend** | Next.js (App Router), Tailwind CSS, Lucide React (icons) — app lives in `web/` |
| **Backend** | Next.js Route Handlers (server-only search and AI APIs); no separate Python service in v1 |
| **Primary data** | Semantic Scholar API (citations, abstracts, TLDRs) |

### LLMs

- **DeepSeek:** Primary provider for ranking and chat when configured.
- **Gemini (Flash-class):** Fallback and long-context tasks; optional PDF analysis later.

## API & Data Strategy

### Search endpoint

`https://api.semanticscholar.org/graph/v1/paper/search`

### Required fields

`title`, `abstract`, `url`, `year`, `citationCount`, `isOpenAccess`, `authors`, `venue`

### Selection logic

When the **Impactful** filter is active, favor papers with **higher citation counts**.

## Implementation Roadmap

| Phase | Focus |
|-------|--------|
| **Phase 1** | **Basic search:** Connect to Semantic Scholar and show results in a clean list/card layout. |
| **Phase 2** | **Filtering & pagination:** Sidebar filters for year, citations, and open-access-only; pagination / load more. |
| **Phase 3** | **AI ranking & summary:** AI Mode — send top ~20 titles/abstracts to DeepSeek/Gemini for a summary and relevance scores. |
| **Phase 4** | **RAG chat:** Simple retrieval-augmented generation so users can ask grounded questions (e.g. *“Which of these papers use a qualitative methodology?”*). |

## See also

- Contributor and AI doc hub: [`docs/agent/README.md`](agent/README.md)
