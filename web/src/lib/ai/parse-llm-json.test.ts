import { describe, expect, it } from "vitest";
import {
  extractJsonObjectString,
  parseLlmJsonObject,
} from "@/lib/ai/parse-llm-json";

describe("parseLlmJsonObject", () => {
  it("parses raw JSON object", () => {
    const v = parseLlmJsonObject('{"reply":"hi","citations":[],"outOfCorpus":false}');
    expect(v).toEqual({ reply: "hi", citations: [], outOfCorpus: false });
  });

  it("parses fenced JSON", () => {
    const raw = "```json\n{\"a\":1}\n```";
    expect(parseLlmJsonObject(raw)).toEqual({ a: 1 });
  });

  it("extracts object from surrounding prose", () => {
    const raw = 'Here you go: {"x":"y"} thanks';
    expect(parseLlmJsonObject(raw)).toEqual({ x: "y" });
  });

  it("returns null on garbage", () => {
    expect(parseLlmJsonObject("not json")).toBeNull();
  });
});

describe("extractJsonObjectString", () => {
  it("returns null when no braces", () => {
    expect(extractJsonObjectString("[]")).toBeNull();
  });
});
