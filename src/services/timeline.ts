import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { stories, storyUnits, timelineEdits, timelines } from "@/db/schema";
import { StoryNotFoundError, TimelineNotFoundError } from "@/domain/errors";
import {
  applyPatches,
  type EditOperation,
  type EditPatch,
  type RenderedTimeline,
  type ScopeType,
  type StoryUnitInput,
  type UnitType,
} from "@/domain/render";

export interface StoryRecord {
  id: string;
  slug: string;
  title: string;
}

export async function getStoryBySlug(
  db: Database,
  slug: string,
): Promise<StoryRecord | null> {
  const rows = await db
    .select({ id: stories.id, slug: stories.slug, title: stories.title })
    .from(stories)
    .where(eq(stories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireStoryBySlug(
  db: Database,
  slug: string,
): Promise<StoryRecord> {
  const story = await getStoryBySlug(db, slug);
  if (!story) throw new StoryNotFoundError(slug);
  return story;
}

export async function getRootTimelineId(
  db: Database,
  storyId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: timelines.id })
    .from(timelines)
    .where(and(eq(timelines.storyId, storyId), isNull(timelines.parentTimelineId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Returns the ancestry of `timelineId` from root to the timeline itself,
 * inclusive. Returns null when the timeline does not exist in this story, which
 * also covers cross-story references.
 */
export async function getTimelinePathIds(
  db: Database,
  storyId: string,
  timelineId: string,
): Promise<string[] | null> {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE ancestry AS (
      SELECT id, parent_timeline_id, 0 AS depth
      FROM timelines
      WHERE id = ${timelineId} AND story_id = ${storyId}
      UNION ALL
      SELECT t.id, t.parent_timeline_id, a.depth + 1
      FROM timelines t
      JOIN ancestry a ON t.id = a.parent_timeline_id
      WHERE t.story_id = ${storyId} AND a.depth < 10000
    )
    SELECT id FROM ancestry ORDER BY depth DESC
  `);
  const ids = Array.from(result).map((row) => row.id);
  return ids.length > 0 ? ids : null;
}

export async function getStoryUnits(
  db: Database,
  storyId: string,
): Promise<StoryUnitInput[]> {
  const rows = await db
    .select({
      id: storyUnits.id,
      position: storyUnits.position,
      unitType: storyUnits.unitType,
      initialText: storyUnits.initialText,
    })
    .from(storyUnits)
    .where(eq(storyUnits.storyId, storyId))
    .orderBy(asc(storyUnits.position));

  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    unitType: row.unitType as UnitType,
    initialText: row.initialText,
  }));
}

/**
 * Loads the patches introduced along an ancestry path in root-to-leaf order.
 * The root has no edit, so a single-element path yields no patches.
 */
export async function getPathPatches(
  db: Database,
  storyId: string,
  pathTimelineIds: string[],
): Promise<EditPatch[]> {
  if (pathTimelineIds.length <= 1) return [];

  const rows = await db
    .select({
      timelineId: timelineEdits.timelineId,
      targetUnitId: timelineEdits.targetUnitId,
      scopeType: timelineEdits.scopeType,
      operation: timelineEdits.operation,
      startOffset: timelineEdits.startOffset,
      endOffset: timelineEdits.endOffset,
      selectedText: timelineEdits.selectedText,
      replacementText: timelineEdits.replacementText,
    })
    .from(timelineEdits)
    .where(
      and(
        eq(timelineEdits.storyId, storyId),
        inArray(timelineEdits.timelineId, pathTimelineIds),
      ),
    );

  const byTimeline = new Map(rows.map((row) => [row.timelineId, row]));

  // Preserve root-to-leaf order regardless of database return order.
  const patches: EditPatch[] = [];
  for (const timelineId of pathTimelineIds) {
    const row = byTimeline.get(timelineId);
    if (!row) continue;
    patches.push({
      timelineId: row.timelineId,
      targetUnitId: row.targetUnitId,
      scopeType: row.scopeType as ScopeType,
      operation: row.operation as EditOperation,
      startOffset: row.startOffset,
      endOffset: row.endOffset,
      selectedText: row.selectedText,
      replacementText: row.replacementText,
    });
  }
  return patches;
}

export interface ChildTimeline {
  id: string;
  label: string | null;
  createdAt: Date;
}

export interface TimelineSummary {
  id: string;
  label: string | null;
  createdAt: Date;
}

/** Summaries for a known list of timeline ids, preserving the requested order. */
export async function getTimelineSummaries(
  db: Database,
  storyId: string,
  timelineIds: string[],
): Promise<TimelineSummary[]> {
  if (timelineIds.length === 0) return [];
  const rows = await db
    .select({
      id: timelines.id,
      label: timelines.label,
      createdAt: timelines.createdAt,
    })
    .from(timelines)
    .where(
      and(
        eq(timelines.storyId, storyId),
        inArray(timelines.id, timelineIds),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return timelineIds
    .map((id) => byId.get(id))
    .filter((row): row is TimelineSummary => row !== undefined);
}

/** Direct children of a timeline, oldest first. */
export async function getChildTimelines(
  db: Database,
  storyId: string,
  parentTimelineId: string,
): Promise<ChildTimeline[]> {
  return db
    .select({
      id: timelines.id,
      label: timelines.label,
      createdAt: timelines.createdAt,
    })
    .from(timelines)
    .where(
      and(
        eq(timelines.storyId, storyId),
        eq(timelines.parentTimelineId, parentTimelineId),
      ),
    )
    .orderBy(asc(timelines.createdAt), asc(timelines.id));
}

/**
 * Deterministic render of a timeline from PostgreSQL data. Rejects timelines
 * that do not exist or belong to a different story.
 */
export async function renderTimeline(
  db: Database,
  storyId: string,
  timelineId: string,
): Promise<RenderedTimeline> {
  const pathTimelineIds = await getTimelinePathIds(db, storyId, timelineId);
  if (!pathTimelineIds) {
    throw new TimelineNotFoundError(storyId, timelineId);
  }

  const units = await getStoryUnits(db, storyId);
  const patches = await getPathPatches(db, storyId, pathTimelineIds);
  const renderedUnits = applyPatches(units, patches);

  return {
    storyId,
    timelineId,
    pathTimelineIds,
    units: renderedUnits,
  };
}
