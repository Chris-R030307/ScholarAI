import { afterEach, describe, expect, it, vi } from "vitest";
import { isLlmAdminDisabled } from "@/lib/llm-admin";

describe("isLlmAdminDisabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when unset", () => {
    vi.stubEnv("SCHOLARAI_LLM_DISABLED", "");
    expect(isLlmAdminDisabled()).toBe(false);
  });

  it("is true for true/1/yes/on", () => {
    for (const v of ["true", "TRUE", "1", "yes", "on"]) {
      vi.stubEnv("SCHOLARAI_LLM_DISABLED", v);
      expect(isLlmAdminDisabled()).toBe(true);
    }
  });
});
