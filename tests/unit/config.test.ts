import { describe, expect, it } from "vitest";

import { requireEnv } from "@/lib/config";

describe("requireEnv", () => {
  it("returns the value when present", () => {
    expect(requireEnv("DATABASE_URL", { DATABASE_URL: "postgres://x" })).toBe(
      "postgres://x",
    );
  });

  it("throws when the variable is missing", () => {
    expect(() => requireEnv("DATABASE_URL", {})).toThrow(
      /Missing required environment variable: DATABASE_URL/,
    );
  });

  it("throws when the variable is blank", () => {
    expect(() => requireEnv("DATABASE_URL", { DATABASE_URL: "   " })).toThrow();
  });
});
