import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { stories, storyUnits, timelines } from "@/db/schema";
import { StoryNotFoundError, TimelineNotFoundError } from "@/domain/errors";
import {
  applyPatches,
  type EditPatch,
  type RenderedTimeline,
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
 * Phase 1 has no edits yet; Phase 2 populates this from `timeline_edits`.
 */
export async function getPathPatches(
  _db: Database,
  _storyId: string,
  _pathTimelineIds: string[],
): Promise<EditPatch[]> {
  return [];
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
