import { describe, expect, it } from "vitest";
import type { Paper } from "@/lib/paper";
import { parseCorpusCartPayload } from "./corpus-cart-storage";

describe("corpus-cart-storage", () => {
  it("parseCorpusCartPayload filters invalid entries", () => {
    const valid: Paper = {
      id: "1",
      title: "T",
      abstract: null,
      url: null,
      year: 2020,
      citationCount: 0,
      isOpenAccess: false,
      authors: [{ name: "A", id: null }],
      venue: null,
    };
    const out = parseCorpusCartPayload([{ bogus: true }, valid]);
    expect(out).toEqual([valid]);
  });

  it("parseCorpusCartPayload returns empty for non-array", () => {
    expect(parseCorpusCartPayload(null)).toEqual([]);
    expect(parseCorpusCartPayload({})).toEqual([]);
  });
});
