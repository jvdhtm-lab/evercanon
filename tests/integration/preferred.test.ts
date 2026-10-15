import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { renderToPlainText } from "@/domain/render";
import { getPreferredTimeline, getPreferredView } from "@/services/preferred";
import { proposeUnitReplacement } from "@/services/proposals";
import { getBranchOptions } from "@/services/timeline";
import { castVote } from "@/services/votes";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

let conn: Connection;
let db: Connection["db"];

async function targetFor(timelineId: string, storyId: string, parentId: string) {
  const branches = await getBranchOptions(db, storyId, parentId, null);
  const branch = branches.find((b) => b.timelineId === timelineId);
  if (!branch?.voteTargetId) throw new Error("branch target missing");
  return branch.voteTargetId;
}

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("preferred timeline", () => {
  it("selects the highest-ranked child and flips when votes change", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `pref-${randomUUID()}`,
      "Preferred",
      ["Seed."],
    );

    const a = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "A version.",
    });
    const b = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "B version.",
    });

    const aTarget = await targetFor(a.timelineId, story.id, root.id);
    const bTarget = await targetFor(b.timelineId, story.id, root.id);

    await castVote(db, { voteTargetId: bTarget, visitorId: randomUUID(), value: 1 });
    let preferred = await getPreferredTimeline(db, story.id);
    expect(preferred?.timelineId).toBe(b.timelineId);

    // Two upvotes on A overtake B's one.
    await castVote(db, { voteTargetId: aTarget, visitorId: randomUUID(), value: 1 });
    await castVote(db, { voteTargetId: aTarget, visitorId: randomUUID(), value: 1 });

    preferred = await getPreferredTimeline(db, story.id);
    expect(preferred?.timelineId).toBe(a.timelineId);

    // Re-running with the same stored votes is deterministic.
    const again = await getPreferredTimeline(db, story.id);
    expect(again).toEqual(preferred);
  });

  it("does not sum descendant votes into an ancestor branch", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `nodsum-${randomUUID()}`,
      "NoDescendantSum",
      ["Seed."],
    );

    const a = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "A version.",
    });
    const b = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "B version.",
    });

    // Give B a single vote, A's branch zero.
    const bTarget = await targetFor(b.timelineId, story.id, root.id);
    await castVote(db, { voteTargetId: bTarget, visitorId: randomUUID(), value: 1 });

    // A has a heavily-upvoted descendant, which must NOT change the root fork.
    const a2 = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: a.timelineId,
      targetUnitId: units[0].id,
      selectedText: "A version.",
      replacementText: "A2 version.",
    });
    const a2Target = await targetFor(a2.timelineId, story.id, a.timelineId);
    for (let i = 0; i < 5; i += 1) {
      await castVote(db, { voteTargetId: a2Target, visitorId: randomUUID(), value: 1 });
    }

    const preferred = await getPreferredTimeline(db, story.id);
    expect(preferred?.path).toEqual([root.id, b.timelineId]);
  });

  it("exposes alternatives per unit with the chosen branch marked", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `alts-${randomUUID()}`,
      "Alternatives",
      ["Seed."],
    );

    const a = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "A version.",
    });
    const b = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Seed.",
      replacementText: "B version.",
    });

    const bTarget = await targetFor(b.timelineId, story.id, root.id);
    await castVote(db, { voteTargetId: bTarget, visitorId: randomUUID(), value: 1 });

    const view = await getPreferredView(db, story.id, null);
    expect(view).not.toBeNull();
    expect(renderToPlainText(view!.rendered.units)).toBe("B version.");

    const unit = view!.units[0];
    expect(unit.changed).toBe(true);
    expect(unit.alternatives).toHaveLength(2);
    const chosen = unit.alternatives.find((alt) => alt.isChosen);
    expect(chosen?.timelineId).toBe(b.timelineId);
    expect(unit.alternatives.map((alt) => alt.timelineId).sort()).toEqual(
      [a.timelineId, b.timelineId].sort(),
    );
  });
});
