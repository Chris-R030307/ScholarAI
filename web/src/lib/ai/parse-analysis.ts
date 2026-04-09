import type { AiRanking } from "@/lib/ai/types";
import { extractJsonObjectString } from "@/lib/ai/parse-llm-json";

export type ParseAnalysisResult =
  | { ok: true; rankings: AiRanking[]; synthesis: string }
  | { ok: false; message: string };

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Validates LLM JSON: only known paper ids, stable ranking list (dedupe by id, last wins).
 * `idOrder` preserves the request order for returned rankings.
 */
export function parseAnalysisJson(
  raw: string,
  validIds: Set<string>,
  idOrder: string[],
): ParseAnalysisResult {
  const jsonStr = extractJsonObjectString(raw);
  if (!jsonStr) {
    return { ok: false, message: "Model output was not valid JSON." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr) as unknown;
  } catch {
    return { ok: false, message: "Model output was not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: "Model JSON must be an object." };
  }
  const obj = parsed as Record<string, unknown>;
  const syn = obj.synthesis;
  if (typeof syn !== "string" || syn.trim() === "") {
    return { ok: false, message: "Missing or empty synthesis string." };
  }
  const rankingsRaw = obj.rankings;
  if (!Array.isArray(rankingsRaw)) {
    return { ok: false, message: "Missing rankings array." };
  }
  const byId = new Map<string, AiRanking>();
  for (const row of rankingsRaw) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const paperId = r.paperId;
    const score = r.score;
    if (typeof paperId !== "string" || !validIds.has(paperId)) continue;
    if (typeof score !== "number") continue;
    const note = r.note;
    byId.set(paperId, {
      paperId,
      score: clampScore(score),
      note: typeof note === "string" && note.trim() !== "" ? note.trim() : undefined,
    });
  }
  const rankings: AiRanking[] = [];
  for (const id of idOrder) {
    if (!validIds.has(id)) continue;
    const existing = byId.get(id);
    if (existing) rankings.push(existing);
    else rankings.push({ paperId: id, score: 0 });
  }
  return { ok: true, rankings, synthesis: syn.trim() };
}
