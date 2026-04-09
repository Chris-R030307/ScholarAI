import type { Paper } from "@/lib/paper";

export type AiRankMeta = { score: number; note?: string };

/**
 * Re-orders the visible list: papers that were scored (top corpus) sort by score desc;
 * tie and unscored rows keep prior list order (baseline).
 */
export function sortDisplayedByAiScores(
  displayed: Paper[],
  rankingById: Map<string, AiRankMeta>,
  analyzedIds: Set<string>,
): Paper[] {
  const baseline = new Map(displayed.map((p, i) => [p.id, i]));
  return [...displayed].sort((a, b) => {
    const inA = analyzedIds.has(a.id);
    const inB = analyzedIds.has(b.id);
    const sa = rankingById.get(a.id)?.score;
    const sb = rankingById.get(b.id)?.score;
    if (inA && inB && sa != null && sb != null && sa !== sb) {
      return sb - sa;
    }
    if (inA && !inB) return -1;
    if (!inA && inB) return 1;
    return (baseline.get(a.id) ?? 0) - (baseline.get(b.id) ?? 0);
  });
}
