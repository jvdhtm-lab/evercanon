import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signVisitorId, verifyVisitorCookie } from "@/domain/visitor";

const SECRET = "a-test-secret-that-is-long-enough-for-hmac";

describe("visitor cookie signing", () => {
  it("round-trips a signed visitor id", () => {
    const id = randomUUID();
    const cookie = signVisitorId(SECRET, id);
    expect(verifyVisitorCookie(SECRET, cookie)).toBe(id);
  });

  it("rejects a tampered signature", () => {
    const cookie = signVisitorId(SECRET, randomUUID());
    const tampered = `${cookie.slice(0, -2)}xx`;
    expect(verifyVisitorCookie(SECRET, tampered)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    const cookie = signVisitorId(SECRET, randomUUID());
    expect(verifyVisitorCookie("another-secret", cookie)).toBeNull();
  });

  it("rejects malformed cookies", () => {
    expect(verifyVisitorCookie(SECRET, "")).toBeNull();
    expect(verifyVisitorCookie(SECRET, "nonsense")).toBeNull();
    expect(verifyVisitorCookie(SECRET, "v1.not-a-uuid.sig")).toBeNull();
    expect(verifyVisitorCookie(SECRET, undefined)).toBeNull();
  });
});
