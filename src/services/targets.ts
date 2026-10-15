import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { voteTargets } from "@/db/schema";
import { ValidationError } from "@/domain/errors";
import { validateSpanSelection } from "@/domain/spans";
import { renderTimeline } from "@/services/timeline";

export interface ResolvedTarget {
  id: string;
  kind: "sentence" | "word" | "phrase";
  targetKey: string;
  text: string;
}

async function findTarget(
  db: Database,
  storyId: string,
  timelineId: string,
  targetKey: string,
): Promise<ResolvedTarget | null> {
  const rows = await db
    .select({
      id: voteTargets.id,
      targetKind: voteTargets.targetKind,
      targetKey: voteTargets.targetKey,
      targetText: voteTargets.targetText,
    })
    .from(voteTargets)
    .where(
      and(
        eq(voteTargets.storyId, storyId),
        eq(voteTargets.timelineId, timelineId),
        eq(voteTargets.targetKey, targetKey),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    kind: row.targetKind as ResolvedTarget["kind"],
    targetKey: row.targetKey,
    text: row.targetText,
  };
}

async function unitTextAt(
  db: Database,
  storyId: string,
  timelineId: string,
  unitId: string,
): Promise<string> {
  const rendered = await renderTimeline(db, storyId, timelineId);
  const unit = rendered.units.find((u) => u.unitId === unitId);
  if (!unit) {
    throw new ValidationError(
      "target_unit_not_found",
      `Unit ${unitId} is not part of this timeline`,
    );
  }
  return unit.text;
}

/** Gets or creates the sentence target for a unit in a timeline rendering. */
export async function resolveSentenceTarget(
  db: Database,
  params: { storyId: string; timelineId: string; unitId: string },
): Promise<ResolvedTarget> {
  const targetKey = `unit:${params.unitId}`;
  const existing = await findTarget(db, params.storyId, params.timelineId, targetKey);
  if (existing) return existing;

  const text = await unitTextAt(db, params.storyId, params.timelineId, params.unitId);
  await db
    .insert(voteTargets)
    .values({
      storyId: params.storyId,
      timelineId: params.timelineId,
      targetKind: "sentence",
      targetUnitId: params.unitId,
      targetText: text,
      targetKey,
    })
    .onConflictDoNothing();

  const created = await findTarget(db, params.storyId, params.timelineId, targetKey);
  if (!created) throw new Error("failed to resolve sentence target");
  return created;
}

/**
 * Gets or creates a word/phrase target for a span of a unit in a timeline
 * rendering. Offsets are validated against the current rendering; a span that
 * splits a surrogate pair or does not match the rendering is rejected.
 */
export async function resolveSpanTarget(
  db: Database,
  params: {
    storyId: string;
    timelineId: string;
    unitId: string;
    startOffset: number;
    endOffset: number;
  },
): Promise<ResolvedTarget> {
  const targetKey = `span:${params.unitId}:${params.startOffset}:${params.endOffset}`;
  const existing = await findTarget(db, params.storyId, params.timelineId, targetKey);
  if (existing) return existing;

  const text = await unitTextAt(db, params.storyId, params.timelineId, params.unitId);
  const selected = text.slice(params.startOffset, params.endOffset);
  const validation = validateSpanSelection(
    text,
    params.startOffset,
    params.endOffset,
    selected,
  );
  if (!validation.valid) {
    throw new ValidationError("invalid_span", validation.reason ?? "invalid span");
  }

  await db
    .insert(voteTargets)
    .values({
      storyId: params.storyId,
      timelineId: params.timelineId,
      targetKind: /\s/.test(selected) ? "phrase" : "word",
      targetUnitId: params.unitId,
      startOffset: params.startOffset,
      endOffset: params.endOffset,
      targetText: selected,
      targetKey,
    })
    .onConflictDoNothing();

  const created = await findTarget(db, params.storyId, params.timelineId, targetKey);
  if (!created) throw new Error("failed to resolve span target");
  return created;
}
