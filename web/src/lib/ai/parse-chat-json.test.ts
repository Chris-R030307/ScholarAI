import { describe, expect, it } from "vitest";
import { parseChatJson } from "@/lib/ai/parse-chat-json";

const ids = new Set(["a", "b"]);

describe("parseChatJson", () => {
  it("accepts valid reply with filtered citations", () => {
    const r = parseChatJson(
      JSON.stringify({
        reply: "Hello",
        citations: ["a", "nope", "b"],
        outOfCorpus: false,
      }),
      ids,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.citations.sort()).toEqual(["a", "b"]);
      expect(r.value.outOfCorpus).toBe(false);
    }
  });

  it("requires empty citations when outOfCorpus", () => {
    const r = parseChatJson(
      JSON.stringify({
        reply: "Not in corpus",
        citations: ["a"],
        outOfCorpus: true,
      }),
      ids,
    );
    expect(r.ok).toBe(false);
  });

  it("normalizes outOfCorpus with empty citations", () => {
    const r = parseChatJson(
      JSON.stringify({
        reply: "I cannot find that in these results.",
        citations: [],
        outOfCorpus: true,
      }),
      ids,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.citations).toEqual([]);
      expect(r.value.outOfCorpus).toBe(true);
    }
  });
});
