/**
 * Administrator switch: set `SCHOLARAI_LLM_DISABLED` to `true` / `1` / `yes` / `on`
 * (case-insensitive) in `web/.env.local` or the host env to turn off all LLM HTTP routes
 * and hide AI UI. Semantic Scholar search stays on.
 */
export function isLlmAdminDisabled(): boolean {
  const v = process.env.SCHOLARAI_LLM_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
