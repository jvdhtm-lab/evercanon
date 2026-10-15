import { describe, expect, it } from "vitest";

import {
  compareBranches,
  pickPreferredBranch,
  type RankableBranch,
} from "@/domain/ranking";

function branch(
  timelineId: string,
  netScore: number,
  upvotes: number,
  createdAt: string,
): RankableBranch {
  return { timelineId, netScore, upvotes, createdAt: new Date(createdAt) };
}

describe("branch ranking", () => {
  it("prefers higher net score", () => {
    const a = branch("a", 1, 3, "2020-01-01T00:00:00Z");
    const b = branch("b", 5, 6, "2020-01-02T00:00:00Z");
    expect(pickPreferredBranch([a, b])?.timelineId).toBe("b");
  });

  it("breaks net-score ties by upvotes", () => {
    const a = branch("a", 2, 2, "2020-01-01T00:00:00Z");
    const b = branch("b", 2, 5, "2020-01-02T00:00:00Z");
    expect(pickPreferredBranch([a, b])?.timelineId).toBe("b");
  });

  it("breaks remaining ties by earlier creation time", () => {
    const a = branch("a", 2, 3, "2020-01-02T00:00:00Z");
    const b = branch("b", 2, 3, "2020-01-01T00:00:00Z");
    expect(pickPreferredBranch([a, b])?.timelineId).toBe("b");
  });

  it("falls back to ascending UUID as the final deterministic breaker", () => {
    const a = branch("bbbb", 0, 0, "2020-01-01T00:00:00Z");
    const b = branch("aaaa", 0, 0, "2020-01-01T00:00:00Z");
    expect(pickPreferredBranch([a, b])?.timelineId).toBe("aaaa");
  });

  it("is deterministic and does not mutate its input", () => {
    const branches = [
      branch("a", 1, 1, "2020-01-01T00:00:00Z"),
      branch("b", 1, 1, "2020-01-01T00:00:00Z"),
    ];
    const snapshot = [...branches];
    const first = pickPreferredBranch(branches)?.timelineId;
    const second = pickPreferredBranch(branches)?.timelineId;
    expect(first).toBe(second);
    expect(branches).toEqual(snapshot);
  });

  it("returns null for an empty fork", () => {
    expect(pickPreferredBranch([])).toBeNull();
  });

  it("compareBranches is antisymmetric", () => {
    const a = branch("a", 1, 1, "2020-01-01T00:00:00Z");
    const b = branch("b", 2, 2, "2020-01-02T00:00:00Z");
    expect(Math.sign(compareBranches(a, b))).toBe(-Math.sign(compareBranches(b, a)));
  });
});
