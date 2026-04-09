import type { SearchApiError } from "@/lib/paper";
import type { SearchResultFilters } from "@/lib/result-filters";

/** Payload item sent to the LLM (trimmed server-side). */
export type AiPaperInput = {
  id: string;
  title: string;
  abstract: string | null;
};

export type AiAnalyzeRequestBody = {
  researchGoal: string;
  papers: AiPaperInput[];
};

export type AiRanking = {
  paperId: string;
  score: number;
  note?: string;
};

export type AiAnalyzeSuccess = {
  rankings: AiRanking[];
  synthesis: string;
  provider: "deepseek" | "gemini";
};

/** Success includes `provider`; error responses omit it. */
export type AiAnalyzeResponse = {
  rankings: AiRanking[];
  synthesis: string;
  provider?: "deepseek" | "gemini";
  error?: SearchApiError;
};

/** Phase 4 chat — `POST /api/ai/chat`. */
export type AiChatResponse = {
  reply: string;
  citations: string[];
  outOfCorpus: boolean;
  provider?: "deepseek" | "gemini";
  error?: SearchApiError;
};

/** `POST /api/ai/search-plan` — Phase 5 AI-guided search. */
export type AiSearchPlanResponse = {
  queries: string[];
  filtersPatch: Partial<SearchResultFilters>;
  rationale?: string;
  provider?: "deepseek" | "gemini";
  error?: SearchApiError;
};
