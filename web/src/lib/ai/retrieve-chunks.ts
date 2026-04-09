import type { Chunk } from "@/lib/ai/chunk-papers";

function tokenize(s: string): string[] {
  const m = s.toLowerCase().match(/[a-z0-9]+/g);
  return m ?? [];
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

/**
 * Lexical TF–IDF-style scoring over the current chunk set (no embedding API).
 * Returns up to `topK` chunks by descending score.
 */
export function retrieveTopChunks(
  query: string,
  chunks: Chunk[],
  topK: number,
): Chunk[] {
  if (chunks.length === 0 || topK <= 0) return [];
  const qTokens = tokenize(query);
  if (qTokens.length === 0) {
    return chunks.slice(0, topK);
  }
  const qTf = termFreq(qTokens);
  const N = chunks.length;
  const df = new Map<string, number>();
  for (const c of chunks) {
    const seen = new Set(tokenize(c.text));
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const scored = chunks.map((c) => {
    const cTf = termFreq(tokenize(c.text));
    let score = 0;
    for (const [term, qCount] of qTf) {
      const rawTf = cTf.get(term) ?? 0;
      if (rawTf === 0) continue;
      const idf = Math.log(1 + N / (1 + (df.get(term) ?? 0)));
      score += (1 + Math.log(rawTf)) * idf * Math.sqrt(qCount);
    }
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score || a.c.chunkIndex - b.c.chunkIndex);
  const out: Chunk[] = [];
  const seenKey = new Set<string>();
  for (const { c } of scored) {
    const key = `${c.paperId}:${c.chunkIndex}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    out.push(c);
    if (out.length >= topK) break;
  }
  return out;
}
