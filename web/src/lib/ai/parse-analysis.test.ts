import { describe, expect, it } from "vitest";
import { parseAnalysisJson } from "@/lib/ai/parse-analysis";

const IDS = new Set(["a", "b"]);

describe("parseAnalysisJson", () => {
  it("accepts clean JSON", () => {
    const raw = JSON.stringify({
      rankings: [
        { paperId: "a", score: 80, note: "x" },
        { paperId: "b", score: 20 },
      ],
      synthesis: "See **a** and b.",
    });
    const r = parseAnalysisJson(raw, IDS, ["a", "b"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.synthesis).toContain("a");
    expect(r.rankings).toHaveLength(2);
    expect(r.rankings.find((x) => x.paperId === "a")?.score).toBe(80);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n" +
      JSON.stringify({
        rankings: [{ paperId: "b", score: 50 }],
        synthesis: "Hello",
      }) +
      "\n```";
    const r = parseAnalysisJson(raw, IDS, ["a", "b"]);
    expect(r.ok).toBe(true);
  });

  it("drops unknown ids and fills missing with score 0", () => {
    const raw = JSON.stringify({
      rankings: [{ paperId: "ghost", score: 99 }],
      synthesis: "Only real papers.",
    });
    const r = parseAnalysisJson(raw, IDS, ["a", "b"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rankings.every((x) => IDS.has(x.paperId))).toBe(true);
    expect(r.rankings.find((x) => x.paperId === "a")?.score).toBe(0);
    expect(r.rankings.find((x) => x.paperId === "b")?.score).toBe(0);
  });

  it("clamps scores", () => {
    const raw = JSON.stringify({
      rankings: [
        { paperId: "a", score: 999 },
        { paperId: "b", score: -5 },
      ],
      synthesis: "x",
    });
    const r = parseAnalysisJson(raw, IDS, ["a", "b"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rankings.find((x) => x.paperId === "a")?.score).toBe(100);
    expect(r.rankings.find((x) => x.paperId === "b")?.score).toBe(0);
  });

  it("rejects missing synthesis", () => {
    const raw = JSON.stringify({ rankings: [] });
    const r = parseAnalysisJson(raw, IDS, ["a", "b"]);
    expect(r.ok).toBe(false);
  });
});
