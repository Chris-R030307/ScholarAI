export const LLM_PROVIDER_STORAGE_KEY = "scholarai_llm_provider";

export type LlmProviderId = "deepseek" | "gemini";

export function loadLlmProviderFromSession(): LlmProviderId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LLM_PROVIDER_STORAGE_KEY);
    if (raw !== "deepseek" && raw !== "gemini") return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveLlmProviderToSession(id: LlmProviderId): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LLM_PROVIDER_STORAGE_KEY, id);
  } catch {
    /* quota / private mode */
  }
}
