import { afterEach, describe, expect, it, vi } from "vitest";
import { accessGateConfigured } from "@/lib/access-gate";

describe("accessGateConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when both vars missing", () => {
    vi.stubEnv("SCHOLARAI_ACCESS_CODE", "");
    vi.stubEnv("ACCESS_GATE_SECRET", "");
    expect(accessGateConfigured()).toBe(false);
  });

  it("is false when only code set", () => {
    vi.stubEnv("SCHOLARAI_ACCESS_CODE", "hello");
    vi.stubEnv("ACCESS_GATE_SECRET", "");
    expect(accessGateConfigured()).toBe(false);
  });

  it("is true when both set", () => {
    vi.stubEnv("SCHOLARAI_ACCESS_CODE", "hello");
    vi.stubEnv("ACCESS_GATE_SECRET", "secret");
    expect(accessGateConfigured()).toBe(true);
  });
});
