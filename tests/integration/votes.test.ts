import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { timelineEdits, voteTargets, votes } from "@/db/schema";
import { VoteTargetNotFoundError } from "@/domain/errors";
import { proposeUnitReplacement } from "@/services/proposals";
import { castVote, getTargetScores } from "@/services/votes";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

let conn: Connection;
let db: Connection["db"];

async function branchTargetId(timelineId: string): Promise<string> {
  const rows = await db
    .select({ id: voteTargets.id })
    .from(voteTargets)
    .where(
      and(eq(voteTargets.timelineId, timelineId), eq(voteTargets.targetKind, "branch")),
    )
    .limit(1);
  return rows[0].id;
}

async function makeBranch() {
  const fixture = await createStoryWithUnits(db, `votes-${randomUUID()}`, "Votes", [
    "Seed sentence.",
  ]);
  const branch = await proposeUnitReplacement(db, {
    storyId: fixture.story.id,
    parentTimelineId: fixture.root.id,
    targetUnitId: fixture.units[0].id,
    selectedText: "Seed sentence.",
    replacementText: "Changed sentence.",
  });
  return { fixture, branch, voteTargetId: await branchTargetId(branch.timelineId) };
}

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("branch vote targets", () => {
  it("creates a branch target when a proposal is accepted", async () => {
    const { voteTargetId } = await makeBranch();
    expect(voteTargetId).toBeTruthy();

    const edit = await db
      .select({ id: timelineEdits.id })
      .from(timelineEdits)
      .limit(1);
    expect(edit.length).toBeGreaterThan(0);
  });

  it("records one vote per visitor and target, and updates in place", async () => {
    const { voteTargetId } = await makeBranch();
    const visitor = randomUUID();

    let result = await castVote(db, { voteTargetId, visitorId: visitor, value: 1 });
    expect(result).toMatchObject({ upvotes: 1, downvotes: 0, netScore: 1, myVote: 1 });

    result = await castVote(db, { voteTargetId, visitorId: visitor, value: 1 });
    expect(result).toMatchObject({ upvotes: 1, downvotes: 0, myVote: 1 });

    result = await castVote(db, { voteTargetId, visitorId: visitor, value: -1 });
    expect(result).toMatchObject({ upvotes: 0, downvotes: 1, netScore: -1, myVote: -1 });

    result = await castVote(db, { voteTargetId, visitorId: visitor, value: 0 });
    expect(result).toMatchObject({ upvotes: 0, downvotes: 0, netScore: 0, myVote: null });

    const rows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(eq(votes.voteTargetId, voteTargetId));
    expect(rows).toHaveLength(0);
  });

  it("lets distinct visitors behind any network address vote independently", async () => {
    const { voteTargetId } = await makeBranch();
    await castVote(db, { voteTargetId, visitorId: randomUUID(), value: 1 });
    await castVote(db, { voteTargetId, visitorId: randomUUID(), value: 1 });
    await castVote(db, { voteTargetId, visitorId: randomUUID(), value: -1 });

    const scores = await getTargetScores(db, voteTargetId);
    expect(scores).toMatchObject({ upvotes: 2, downvotes: 1, netScore: 1 });
  });

  it("keeps a single row under concurrent votes from one visitor", async () => {
    const { voteTargetId } = await makeBranch();
    const visitor = randomUUID();

    await Promise.all(
      Array.from({ length: 10 }, () =>
        castVote(db, { voteTargetId, visitorId: visitor, value: 1, rateLimit: false }),
      ),
    );

    const rows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(eq(votes.voteTargetId, voteTargetId), eq(votes.visitorId, visitor)),
      );
    expect(rows).toHaveLength(1);
  });

  it("rejects votes for an unknown target", async () => {
    await expect(
      castVote(db, {
        voteTargetId: randomUUID(),
        visitorId: randomUUID(),
        value: 1,
      }),
    ).rejects.toBeInstanceOf(VoteTargetNotFoundError);
  });

  it("enforces the unique (visitor, target) constraint at the database", async () => {
    const { voteTargetId } = await makeBranch();
    const visitor = randomUUID();
    await castVote(db, { voteTargetId, visitorId: visitor, value: 1 });

    await expect(
      db.insert(votes).values({ visitorId: visitor, voteTargetId, value: -1 }),
    ).rejects.toThrow();
  });
});
