import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { visitors, votes, voteTargets } from "@/db/schema";
import {
  RateLimitError,
  ValidationError,
  VoteTargetNotFoundError,
} from "@/domain/errors";
import { checkRateLimit } from "@/lib/rateLimit";
import { recomputeVoteAttributions } from "@/services/attribution";

export type VoteValue = 1 | 0 | -1;

export interface VoteTargetInfo {
  id: string;
  storyId: string;
  timelineId: string;
  targetKind: string;
  targetKey: string;
}

export interface VoteResult {
  voteTargetId: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  myVote: number | null;
}

export async function getVoteTarget(
  db: Database,
  voteTargetId: string,
): Promise<VoteTargetInfo | null> {
  const rows = await db
    .select({
      id: voteTargets.id,
      storyId: voteTargets.storyId,
      timelineId: voteTargets.timelineId,
      targetKind: voteTargets.targetKind,
      targetKey: voteTargets.targetKey,
    })
    .from(voteTargets)
    .where(eq(voteTargets.id, voteTargetId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTargetScores(
  db: Database,
  voteTargetId: string,
): Promise<{ upvotes: number; downvotes: number; netScore: number }> {
  const result = await db.execute<{
    upvotes: number;
    downvotes: number;
    net_score: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE value = 1)::int AS upvotes,
      COUNT(*) FILTER (WHERE value = -1)::int AS downvotes,
      COALESCE(SUM(value), 0)::int AS net_score
    FROM votes
    WHERE vote_target_id = ${voteTargetId}
  `);
  const row = Array.from(result)[0];
  return {
    upvotes: row?.upvotes ?? 0,
    downvotes: row?.downvotes ?? 0,
    netScore: row?.net_score ?? 0,
  };
}

export function isValidVoteValue(value: unknown): value is VoteValue {
  return value === 1 || value === 0 || value === -1;
}

/**
 * Sets, changes, or clears a visitor's vote. Enforced one-row-per-(visitor,
 * target) by a unique constraint, so repeated or concurrent clicks cannot
 * create duplicates. Scores are computed from the ledger, never from clients.
 */
export async function castVote(
  db: Database,
  input: {
    voteTargetId: string;
    visitorId: string;
    value: VoteValue;
    rateLimit?: boolean;
  },
): Promise<VoteResult> {
  const { voteTargetId, visitorId, value } = input;
  if (!isValidVoteValue(value)) {
    throw new ValidationError("invalid_vote_value", "Vote value must be -1, 0, or 1");
  }
  if (input.rateLimit !== false && !checkRateLimit(`vote:${visitorId}`, 60, 60_000)) {
    throw new RateLimitError();
  }

  const target = await getVoteTarget(db, voteTargetId);
  if (!target) throw new VoteTargetNotFoundError(voteTargetId);

  await db.transaction(async (tx) => {
    await tx
      .insert(visitors)
      .values({ id: visitorId })
      .onConflictDoUpdate({
        target: visitors.id,
        set: { lastSeenAt: new Date() },
      });

    if (value === 0) {
      await tx
        .delete(votes)
        .where(
          and(
            eq(votes.visitorId, visitorId),
            eq(votes.voteTargetId, voteTargetId),
          ),
        );
    } else {
      await tx
        .insert(votes)
        .values({ visitorId, voteTargetId, value })
        .onConflictDoUpdate({
          target: [votes.visitorId, votes.voteTargetId],
          set: { value, updatedAt: new Date() },
        });

      const [row] = await tx
        .select({ id: votes.id })
        .from(votes)
        .where(
          and(eq(votes.visitorId, visitorId), eq(votes.voteTargetId, voteTargetId)),
        )
        .limit(1);
      if (row) await recomputeVoteAttributions(tx, row.id);
    }
  });

  const scores = await getTargetScores(db, voteTargetId);
  return {
    voteTargetId,
    ...scores,
    myVote: value === 0 ? null : value,
  };
}
