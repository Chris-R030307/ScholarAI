/** Bounds for Phase 3 AI analyze — align with docs/agent/plan.md P3. */

export const AI_MAX_PAPERS = 20;
export const AI_MAX_ABSTRACT_CHARS = 2000;
export const AI_TIMEOUT_MS = 45_000;
/** Rough guard on POST body size (characters of serialized papers). */
export const AI_MAX_INPUT_CHARS = 100_000;
export const AI_LLM_MAX_OUTPUT_TOKENS = 4096;
/** Minimum interval between successful analyze calls per client key (IP). */
export const AI_RATE_LIMIT_MS = 10_000;

/** Phase 4 chat — corpus and prompt bounds. */
export const AI_CHAT_MAX_PAPERS = 80;
export const AI_CHAT_MAX_MESSAGES = 24;
export const AI_CHAT_MAX_MESSAGE_CHARS = 4000;
export const AI_CHAT_TOP_CHUNKS = 18;
export const AI_CHAT_MAX_INPUT_CHARS = 120_000;
/** Minimum interval between successful chat completions per client key. */
export const AI_CHAT_RATE_LIMIT_MS = 4000;
