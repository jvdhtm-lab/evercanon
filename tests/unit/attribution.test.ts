import { describe, expect, it } from "vitest";

import {
  computeAttributions,
  type AttributionTarget,
} from "@/domain/attribution";

function target(
  id: string,
  kind: AttributionTarget["kind"],
  timelineId: string,
  unitId: string | null,
): AttributionTarget {
  return { id, kind, timelineId, unitId };
}

describe("computeAttributions", () => {
  it("only marks a branch vote as direct", () => {
    const branch = target("branch", "branch", "t1", null);
    expect(computeAttributions(branch, [branch])).toEqual([
      { supportedTargetId: "branch", kind: "direct", weight: 1 },
    ]);
  });

  it("attributes a sentence vote to contained word/phrase targets", () => {
    const sentence = target("s", "sentence", "t1", "u1");
    const word = target("w", "word", "t1", "u1");
    const phrase = target("p", "phrase", "t1", "u1");
    const rows = computeAttributions(sentence, [sentence, word, phrase]);
    expect(rows).toEqual([
      { supportedTargetId: "s", kind: "direct", weight: 1 },
      { supportedTargetId: "w", kind: "contained", weight: 1 },
      { supportedTargetId: "p", kind: "contained", weight: 1 },
    ]);
  });

  it("attributes a word/phrase vote to its containing sentence", () => {
    const sentence = target("s", "sentence", "t1", "u1");
    const word = target("w", "word", "t1", "u1");
    expect(computeAttributions(word, [sentence, word])).toEqual([
      { supportedTargetId: "w", kind: "direct", weight: 1 },
      { supportedTargetId: "s", kind: "ancestor", weight: 1 },
    ]);
  });

  it("never attributes to unrelated units or timelines", () => {
    const sentence = target("s", "sentence", "t1", "u1");
    const otherUnit = target("w2", "word", "t1", "u2");
    const otherTimeline = target("w3", "word", "t2", "u1");
    const rows = computeAttributions(sentence, [sentence, otherUnit, otherTimeline]);
    expect(rows).toEqual([{ supportedTargetId: "s", kind: "direct", weight: 1 }]);
  });

  it("does not recurse: a word vote does not support sibling words", () => {
    const word = target("w", "word", "t1", "u1");
    const siblingWord = target("w2", "word", "t1", "u1");
    const sentence = target("s", "sentence", "t1", "u1");
    const rows = computeAttributions(word, [word, siblingWord, sentence]);
    expect(rows.map((r) => r.supportedTargetId).sort()).toEqual(["s", "w"]);
  });
});
