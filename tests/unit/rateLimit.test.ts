import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, resetRateLimits } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit within a window", () => {
    const t0 = 1_000;
    expect(checkRateLimit("k", 3, 1000, t0)).toBe(true);
    expect(checkRateLimit("k", 3, 1000, t0)).toBe(true);
    expect(checkRateLimit("k", 3, 1000, t0)).toBe(true);
    expect(checkRateLimit("k", 3, 1000, t0)).toBe(false);
  });

  it("resets after the window elapses", () => {
    expect(checkRateLimit("k", 1, 1000, 0)).toBe(true);
    expect(checkRateLimit("k", 1, 1000, 500)).toBe(false);
    expect(checkRateLimit("k", 1, 1000, 1001)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(checkRateLimit("a", 1, 1000, 0)).toBe(true);
    expect(checkRateLimit("b", 1, 1000, 0)).toBe(true);
  });
});
