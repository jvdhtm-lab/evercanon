import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Drizzle definitions for Evercanon. They mirror the schema created by the
 * reviewed SQL migrations in `db/migrations`, which remain the canonical
 * schema-evolution path. Keep this file aligned with those migrations.
 */

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  seededAt: timestamp("seeded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const storyUnits = pgTable(
  "story_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    unitType: text("unit_type").notNull(),
    initialText: text("initial_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("story_units_id_story_id_key").on(t.id, t.storyId),
    unique("story_units_story_position_key").on(t.storyId, t.position),
  ],
);

export const timelines = pgTable(
  "timelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "restrict" }),
    parentTimelineId: uuid("parent_timeline_id"),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("timelines_id_story_id_key").on(t.id, t.storyId),
    foreignKey({
      columns: [t.parentTimelineId, t.storyId],
      foreignColumns: [t.id, t.storyId],
      name: "timeline_parent_same_story_fk",
    }).onDelete("restrict"),
    uniqueIndex("one_root_timeline_per_story")
      .on(t.storyId)
      .where(sql`${t.parentTimelineId} is null`),
    index("timelines_parent_idx").on(t.parentTimelineId),
    index("timelines_story_created_idx").on(t.storyId, t.createdAt),
  ],
);

export const timelineEdits = pgTable(
  "timeline_edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "restrict" }),
    timelineId: uuid("timeline_id").notNull().unique(),
    targetUnitId: uuid("target_unit_id").notNull(),
    scopeType: text("scope_type").notNull(),
    operation: text("operation").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    selectedText: text("selected_text").notNull().default(""),
    replacementText: text("replacement_text").notNull().default(""),
    parentTextHash: text("parent_text_hash").notNull(),
    requestKey: text("request_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.timelineId, t.storyId],
      foreignColumns: [timelines.id, timelines.storyId],
      name: "timeline_edits_timeline_story_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.targetUnitId, t.storyId],
      foreignColumns: [storyUnits.id, storyUnits.storyId],
      name: "timeline_edits_target_unit_story_fk",
    }).onDelete("restrict"),
    index("timeline_edits_target_idx").on(t.targetUnitId),
    uniqueIndex("timeline_edits_request_key_key")
      .on(t.storyId, t.requestKey)
      .where(sql`${t.requestKey} is not null`),
  ],
);
