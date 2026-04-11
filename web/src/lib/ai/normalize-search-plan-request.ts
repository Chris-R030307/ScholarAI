import { AI_SEARCH_PLAN_MAX_INTENT_CHARS } from "@/lib/ai/constants";

export type NormalizeSearchPlanBodyResult =
  | {
      ok: true;
      intent: string;
      providerPreference?: "deepseek" | "gemini";
    }
  | { ok: false; code: string; message: string };

export function normalizeSearchPlanBody(body: unknown): NormalizeSearchPlanBodyResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, code: "BAD_REQUEST", message: "Body must be a JSON object." };
  }
  const o = body as Record<string, unknown>;
  const intent = o.intent;
  if (typeof intent !== "string" || intent.trim() === "") {
    return { ok: false, code: "BAD_REQUEST", message: "Field intent is required." };
  }
  const t = intent.trim();
  if (t.length > AI_SEARCH_PLAN_MAX_INTENT_CHARS) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `Intent is too long (max ${AI_SEARCH_PLAN_MAX_INTENT_CHARS} characters).`,
    };
  }

  const prefRaw = o.providerPreference;
  let providerPreference: "deepseek" | "gemini" | undefined;
  if (prefRaw !== undefined && prefRaw !== null) {
    if (prefRaw !== "deepseek" && prefRaw !== "gemini") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: 'Field providerPreference must be "deepseek" or "gemini" when provided.',
      };
    }
    providerPreference = prefRaw;
  }

  return providerPreference
    ? { ok: true, intent: t, providerPreference }
    : { ok: true, intent: t };
}
