import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { voteAttributions, votes, voteTargets } from "@/db/schema";
import {
  computeAttributions,
  type AttributionTarget,
  type TargetKind,
} from "@/domain/attribution";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface TargetRow {
  id: string;
  targetKind: string;
  timelineId: string;
  targetUnitId: string | null;
}

function toTarget(row: TargetRow): AttributionTarget {
  return {
    id: row.id,
    kind: row.targetKind as TargetKind,
    timelineId: row.timelineId,
    unitId: row.targetUnitId,
  };
}

/**
 * Recomputes the derived-support rows for one direct vote. Runs inside the
 * caller's transaction so the vote and its projection stay consistent. Rows are
 * a pure projection of the direct vote; they are deleted and rebuilt, never
 * treated as new votes.
 */
export async function recomputeVoteAttributions(
  tx: Tx,
  voteId: string,
): Promise<void> {
  await tx.delete(voteAttributions).where(eq(voteAttributions.voteId, voteId));

  const [vote] = await tx
    .select({ voteTargetId: votes.voteTargetId })
    .from(votes)
    .where(eq(votes.id, voteId))
    .limit(1);
  if (!vote) return;

  const [target] = await tx
    .select({
      id: voteTargets.id,
      targetKind: voteTargets.targetKind,
      timelineId: voteTargets.timelineId,
      targetUnitId: voteTargets.targetUnitId,
    })
    .from(voteTargets)
    .where(eq(voteTargets.id, vote.voteTargetId))
    .limit(1);
  if (!target) return;

  const candidates = target.targetUnitId
    ? await tx
        .select({
          id: voteTargets.id,
          targetKind: voteTargets.targetKind,
          timelineId: voteTargets.timelineId,
          targetUnitId: voteTargets.targetUnitId,
        })
        .from(voteTargets)
        .where(
          and(
            eq(voteTargets.timelineId, target.timelineId),
            eq(voteTargets.targetUnitId, target.targetUnitId),
          ),
        )
    : [];

  const rows = computeAttributions(toTarget(target), candidates.map(toTarget));
  if (rows.length === 0) return;

  await tx
    .insert(voteAttributions)
    .values(
      rows.map((row) => ({
        voteId,
        supportedTargetId: row.supportedTargetId,
        attributionKind: row.kind,
        weight: row.weight,
      })),
    )
    .onConflictDoNothing();
}

/** Rebuilds every attribution row from the direct vote ledger. */
export async function rebuildAllAttributions(db: Database): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.delete(voteAttributions);
    const voteRows = await tx.select({ id: votes.id }).from(votes);
    for (const vote of voteRows) {
      await recomputeVoteAttributions(tx, vote.id);
    }
    return voteRows.length;
  });
}

export interface AttributionBreakdownRow {
  kind: string;
  value: number;
  weight: number;
}

/** Derived support rows backing a target, for display and verification. */
export async function getAttributionBreakdown(
  db: Database,
  targetId: string,
): Promise<AttributionBreakdownRow[]> {
  const result = await db.execute<{ kind: string; value: number; weight: number }>(sql`
    SELECT a.attribution_kind AS kind, v.value AS value, a.weight AS weight
    FROM vote_attributions a
    JOIN votes v ON v.id = a.vote_id
    WHERE a.supported_target_id = ${targetId}
  `);
  return Array.from(result).map((row) => ({
    kind: row.kind,
    value: row.value,
    weight: row.weight,
  }));
}

/** Score for a target including derived contained/ancestor support. */
export async function getAttributedScore(
  db: Database,
  targetId: string,
): Promise<number> {
  const result = await db.execute<{ score: number }>(sql`
    SELECT COALESCE(SUM(v.value * a.weight), 0)::int AS score
    FROM vote_attributions a
    JOIN votes v ON v.id = a.vote_id
    WHERE a.supported_target_id = ${targetId}
  `);
  return Array.from(result)[0]?.score ?? 0;
}
