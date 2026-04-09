import { describe, expect, it } from "vitest";
import { parseSearchPlanJson } from "@/lib/ai/parse-search-plan";

describe("parseSearchPlanJson", () => {
  it("accepts minimal valid plan", () => {
    const r = parseSearchPlanJson(
      JSON.stringify({
        queries: ["neural architecture search"],
        openAccessOnly: false,
        venueKind: "any",
        useImpactfulSort: false,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.queries).toEqual(["neural architecture search"]);
      expect(r.value.filtersPatch.impactful).toBe(false);
    }
  });

  it("parses fenced output", () => {
    const r = parseSearchPlanJson(
      '```json\n{"queries":["a","b"],"rationale":"ok"}\n```',
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.queries).toEqual(["a", "b"]);
      expect(r.value.rationale).toBe("ok");
    }
  });

  it("caps query count and length", () => {
    const long = "x".repeat(400);
    const r = parseSearchPlanJson(
      JSON.stringify({
        queries: ["a", "b", "c", "d"],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.queries.length).toBe(3);

    const r2 = parseSearchPlanJson(
      JSON.stringify({
        queries: [long],
      }),
    );
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.queries[0].length).toBeLessThanOrEqual(280);
  });

  it("rejects empty queries", () => {
    const r = parseSearchPlanJson(JSON.stringify({ queries: [] }));
    expect(r.ok).toBe(false);
  });
});
