import { AI_SEARCH_PLAN_MAX_INTENT_CHARS } from "@/lib/ai/constants";

export type NormalizeSearchPlanBodyResult =
  | { ok: true; intent: string }
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
  return { ok: true, intent: t };
}
