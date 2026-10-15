import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { votes } from "@/db/schema";
import {
  getAttributedScore,
  getAttributionBreakdown,
  rebuildAllAttributions,
} from "@/services/attribution";
import { resolveSentenceTarget, resolveSpanTarget } from "@/services/targets";
import { castVote } from "@/services/votes";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

let conn: Connection;
let db: Connection["db"];

async function makeStory(sentence: string) {
  const fixture = await createStoryWithUnits(db, `attr-${randomUUID()}`, "Attr", [
    sentence,
  ]);
  return fixture;
}

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("vote attribution", () => {
  it("keeps one vote row while creating contained support rows", async () => {
    const { story, units, root } = await makeStory("the quick brown fox");
    const sentence = await resolveSentenceTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
    });
    const quick = await resolveSpanTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
      startOffset: 4,
      endOffset: 9,
    });
    const brown = await resolveSpanTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
      startOffset: 10,
      endOffset: 15,
    });
    expect(quick.kind).toBe("word");
    expect(quick.text).toBe("quick");

    const visitor = randomUUID();
    await castVote(db, { voteTargetId: sentence.id, visitorId: visitor, value: 1 });

    const rows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(eq(votes.visitorId, visitor));
    expect(rows).toHaveLength(1);

    expect(await getAttributionBreakdown(db, quick.id)).toEqual([
      { kind: "contained", value: 1, weight: 1 },
    ]);
    expect(await getAttributionBreakdown(db, brown.id)).toEqual([
      { kind: "contained", value: 1, weight: 1 },
    ]);
    expect(await getAttributedScore(db, quick.id)).toBe(1);
  });

  it("propagates word support to the containing sentence", async () => {
    const { story, units, root } = await makeStory("the quick brown fox");
    const sentence = await resolveSentenceTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
    });
    const quick = await resolveSpanTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
      startOffset: 4,
      endOffset: 9,
    });

    const sentenceVoter = randomUUID();
    const wordVoter = randomUUID();
    await castVote(db, { voteTargetId: sentence.id, visitorId: sentenceVoter, value: 1 });
    await castVote(db, { voteTargetId: quick.id, visitorId: wordVoter, value: 1 });

    const kinds = (await getAttributionBreakdown(db, sentence.id))
      .map((row) => row.kind)
      .sort();
    expect(kinds).toEqual(["ancestor", "direct"]);
    expect(await getAttributedScore(db, sentence.id)).toBe(2);
  });

  it("rebuilds attributions on vote change without duplicates", async () => {
    const { story, units, root } = await makeStory("the quick brown fox");
    const sentence = await resolveSentenceTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
    });
    const quick = await resolveSpanTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
      startOffset: 4,
      endOffset: 9,
    });

    const sentenceVoter = randomUUID();
    const wordVoter = randomUUID();
    await castVote(db, { voteTargetId: sentence.id, visitorId: sentenceVoter, value: 1 });
    await castVote(db, { voteTargetId: quick.id, visitorId: wordVoter, value: 1 });
    await castVote(db, { voteTargetId: quick.id, visitorId: wordVoter, value: -1 });

    const ancestors = (await getAttributionBreakdown(db, sentence.id)).filter(
      (row) => row.kind === "ancestor",
    );
    expect(ancestors).toHaveLength(1);
    expect(await getAttributedScore(db, sentence.id)).toBe(0);

    // Clearing the word vote removes its ancestor support.
    await castVote(db, { voteTargetId: quick.id, visitorId: wordVoter, value: 0 });
    expect(
      (await getAttributionBreakdown(db, sentence.id)).filter(
        (row) => row.kind === "ancestor",
      ),
    ).toHaveLength(0);
    expect(await getAttributedScore(db, sentence.id)).toBe(1);
  });

  it("recomputes an identical projection from the ledger", async () => {
    const { story, units, root } = await makeStory("the quick brown fox");
    const sentence = await resolveSentenceTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
    });
    await resolveSpanTarget(db, {
      storyId: story.id,
      timelineId: root.id,
      unitId: units[0].id,
      startOffset: 4,
      endOffset: 9,
    });

    await castVote(db, { voteTargetId: sentence.id, visitorId: randomUUID(), value: 1 });
    const before = await getAttributionBreakdown(db, sentence.id);

    await rebuildAllAttributions(db);
    const after = await getAttributionBreakdown(db, sentence.id);

    expect(after).toEqual(before);
  });
});
