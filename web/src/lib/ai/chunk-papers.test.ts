import { describe, expect, it } from "vitest";
import { chunkPaper, chunkPapers } from "@/lib/ai/chunk-papers";

describe("chunkPaper", () => {
  it("tags every chunk with paperId and stable chunkIndex", () => {
    const paper = {
      id: "p1",
      title: "Hello",
      abstract: "x".repeat(2000),
    };
    const chunks = chunkPaper(paper);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].paperId).toBe("p1");
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].text).toContain("[paperId:p1]");
    }
  });

  it("uses a single chunk for title only", () => {
    const chunks = chunkPaper({
      id: "a",
      title: "Only title",
      abstract: null,
    });
    expect(chunks).toEqual([
      {
        paperId: "a",
        text: "[paperId:a]\nTitle: Only title",
        chunkIndex: 0,
      },
    ]);
  });

  it("keeps short abstract in one chunk", () => {
    const chunks = chunkPaper({
      id: "b",
      title: "T",
      abstract: "Short text.",
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Title: T");
    expect(chunks[0].text).toContain("Abstract: Short text.");
  });
});

describe("chunkPapers", () => {
  it("concatenates per-paper chunks in order", () => {
    const all = chunkPapers([
      { id: "1", title: "A", abstract: "aa" },
      { id: "2", title: "B", abstract: null },
    ]);
    expect(all.map((c) => c.paperId)).toEqual(["1", "2"]);
    expect(all[1].chunkIndex).toBe(0);
  });
});
