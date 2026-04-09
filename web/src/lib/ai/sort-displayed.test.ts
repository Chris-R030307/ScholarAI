import { describe, expect, it } from "vitest";
import type { Paper } from "@/lib/paper";
import { sortDisplayedByAiScores } from "@/lib/ai/sort-displayed";

function p(id: string, title: string): Paper {
  return {
    id,
    title,
    abstract: null,
    url: null,
    year: 2020,
    citationCount: 0,
    isOpenAccess: false,
    authors: [],
    venue: null,
  };
}

describe("sortDisplayedByAiScores", () => {
  it("orders analyzed papers by score and keeps baseline for the rest", () => {
    const displayed = [p("a", "A"), p("b", "B"), p("c", "C")];
    const rankingById = new Map([
      ["a", { score: 10 }],
      ["b", { score: 90 }],
    ]);
    const analyzed = new Set(["a", "b"]);
    const out = sortDisplayedByAiScores(displayed, rankingById, analyzed);
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("uses baseline order for ties", () => {
    const displayed = [p("a", "A"), p("b", "B")];
    const rankingById = new Map([
      ["a", { score: 50 }],
      ["b", { score: 50 }],
    ]);
    const analyzed = new Set(["a", "b"]);
    const out = sortDisplayedByAiScores(displayed, rankingById, analyzed);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
