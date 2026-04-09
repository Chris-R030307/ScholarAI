import { describe, expect, it } from "vitest";
import type { Chunk } from "@/lib/ai/chunk-papers";
import { retrieveTopChunks } from "@/lib/ai/retrieve-chunks";

const chunks: Chunk[] = [
  {
    paperId: "a",
    text: "[paperId:a]\nTitle: Cats\n\nAbstract: qualitative interviews with users",
    chunkIndex: 0,
  },
  {
    paperId: "b",
    text: "[paperId:b]\nTitle: Dogs\n\nAbstract: randomized controlled trial methodology",
    chunkIndex: 0,
  },
  {
    paperId: "c",
    text: "[paperId:c]\nTitle: Fish\n\nAbstract: underwater imaging sensors",
    chunkIndex: 0,
  },
];

describe("retrieveTopChunks", () => {
  it("ranks chunks that share query terms higher", () => {
    const top = retrieveTopChunks("qualitative methodology", chunks, 2);
    const ids = top.map((c) => c.paperId).sort();
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("returns first chunks when query is empty after tokenization", () => {
    const top = retrieveTopChunks("???", chunks, 2);
    expect(top.length).toBeLessThanOrEqual(2);
  });

  it("returns up to topK unique chunks", () => {
    const top = retrieveTopChunks("imaging", chunks, 10);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top[0].paperId).toBe("c");
  });
});
