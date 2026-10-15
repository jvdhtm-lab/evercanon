import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { stories, storyUnits, timelines } from "@/db/schema";
import { SEED_SENTENCE } from "@/db/seed";
import { TimelineNotFoundError } from "@/domain/errors";
import { renderToPlainText } from "@/domain/render";
import {
  getRootTimelineId,
  getStoryBySlug,
  renderTimeline,
} from "@/services/timeline";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";

let conn: Connection;
let db: Connection["db"];

async function createStoryWithUnits(
  slug: string,
  title: string,
  sentences: string[],
) {
  const [story] = await db
    .insert(stories)
    .values({ slug, title })
    .returning();
  const units = await db
    .insert(storyUnits)
    .values(
      sentences.map((text, index) => ({
        storyId: story.id,
        position: index,
        unitType: "sentence",
        initialText: text,
      })),
    )
    .returning();
  const [root] = await db
    .insert(timelines)
    .values({ storyId: story.id, label: "seed" })
    .returning();
  return { story, units, root };
}

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("renderTimeline", () => {
  it("renders the seeded opening sentence from PostgreSQL", async () => {
    const story = await getStoryBySlug(db, "the-beginning");
    expect(story).not.toBeNull();
    const rootId = await getRootTimelineId(db, story!.id);
    expect(rootId).not.toBeNull();

    const rendered = await renderTimeline(db, story!.id, rootId!);
    expect(renderToPlainText(rendered.units)).toBe(SEED_SENTENCE);
    expect(rendered.pathTimelineIds).toEqual([rootId]);
  });

  it("returns units in stable position order", async () => {
    const { story, root } = await createStoryWithUnits(
      "ordering",
      "Ordering",
      ["First.", "Second.", "Third."],
    );
    const rendered = await renderTimeline(db, story.id, root.id);
    expect(rendered.units.map((u) => u.position)).toEqual([0, 1, 2]);
    expect(rendered.units.map((u) => u.text)).toEqual([
      "First.",
      "Second.",
      "Third.",
    ]);
  });

  it("is deterministic across repeated calls", async () => {
    const story = await getStoryBySlug(db, "the-beginning");
    const rootId = (await getRootTimelineId(db, story!.id))!;
    const a = await renderTimeline(db, story!.id, rootId);
    const b = await renderTimeline(db, story!.id, rootId);
    expect(a).toEqual(b);
  });

  it("rejects a nonexistent timeline id", async () => {
    const story = await getStoryBySlug(db, "the-beginning");
    await expect(
      renderTimeline(db, story!.id, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(TimelineNotFoundError);
  });

  it("rejects a timeline id belonging to another story", async () => {
    const main = await getStoryBySlug(db, "the-beginning");
    const { root } = await createStoryWithUnits(
      "other-story",
      "Other",
      ["Another beginning."],
    );

    await expect(
      renderTimeline(db, main!.id, root.id),
    ).rejects.toBeInstanceOf(TimelineNotFoundError);
  });
});
