/**
 * LLMs sometimes wrap JSON in markdown fences or extra prose — extract an object payload.
 */

export function extractJsonObjectString(raw: string): string | null {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const candidate = fence ? fence[1].trim() : t;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export function parseLlmJsonObject(raw: string): unknown | null {
  const extracted = extractJsonObjectString(raw);
  const attempts = extracted != null ? [extracted, raw.trim()] : [raw.trim()];
  for (const s of attempts) {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      /* try next */
    }
  }
  return null;
}
