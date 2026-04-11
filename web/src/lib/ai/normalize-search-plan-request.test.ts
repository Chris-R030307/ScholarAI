import { describe, expect, it } from "vitest";
import { normalizeSearchPlanBody } from "@/lib/ai/normalize-search-plan-request";

describe("normalizeSearchPlanBody", () => {
  it("accepts intent only", () => {
    const r = normalizeSearchPlanBody({ intent: "  neural nets  " });
    expect(r).toEqual({ ok: true, intent: "neural nets" });
  });

  it("accepts providerPreference deepseek", () => {
    const r = normalizeSearchPlanBody({
      intent: "x",
      providerPreference: "deepseek",
    });
    expect(r).toEqual({
      ok: true,
      intent: "x",
      providerPreference: "deepseek",
    });
  });

  it("rejects invalid providerPreference", () => {
    const r = normalizeSearchPlanBody({
      intent: "x",
      providerPreference: "openai",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("BAD_REQUEST");
    }
  });
});
