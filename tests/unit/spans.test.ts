import { describe, expect, it } from "vitest";

import { splitsSurrogatePair, validateSpanSelection } from "@/domain/spans";

describe("span validation", () => {
  it("accepts a valid in-bounds selection", () => {
    expect(validateSpanSelection("hello world", 6, 11, "world").valid).toBe(true);
  });

  it("rejects out-of-bounds offsets", () => {
    expect(validateSpanSelection("hello", 3, 99, "lo").valid).toBe(false);
    expect(validateSpanSelection("hello", -1, 2, "he").valid).toBe(false);
    expect(validateSpanSelection("hello", 3, 1, "").valid).toBe(false);
  });

  it("rejects a selection that does not match the text", () => {
    expect(validateSpanSelection("hello", 0, 5, "nope").valid).toBe(false);
  });

  it("does not split an emoji surrogate pair", () => {
    const text = "a\u{1F600}b"; // 'a', emoji, 'b' => UTF-16 length 4
    expect(validateSpanSelection(text, 1, 3, "\u{1F600}").valid).toBe(true);
    expect(validateSpanSelection(text, 2, 3, "b").valid).toBe(false);
    expect(validateSpanSelection(text, 0, 2, "a\uD83D").valid).toBe(false);
    expect(splitsSurrogatePair(text, 2)).toBe(true);
    expect(splitsSurrogatePair(text, 1)).toBe(false);
  });

  it("handles combining marks as ordinary UTF-16 units", () => {
    const text = "cafe\u0301"; // e + combining acute, length 5
    expect(validateSpanSelection(text, 0, 5, "cafe\u0301").valid).toBe(true);
    expect(validateSpanSelection(text, 3, 5, "e\u0301").valid).toBe(true);
  });
});
