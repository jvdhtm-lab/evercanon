import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { timelineEdits, timelines } from "@/db/schema";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

// These tests write invalid rows directly to PostgreSQL. Application-layer
// validation is not sufficient proof that the database contract holds.

let conn: Connection;
let db: Connection["db"];

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("database constraints", () => {
  it("allows only one root timeline per story", async () => {
    const { story } = await createStoryWithUnits(db, "one-root", "OneRoot", [
      "x.",
    ]);

    await expect(
      db.insert(timelines).values({ storyId: story.id }),
    ).rejects.toThrow();
  });

  it("rejects a parent timeline that belongs to another story", async () => {
    const a = await createStoryWithUnits(db, "fk-a", "A", ["a."]);
    const b = await createStoryWithUnits(db, "fk-b", "B", ["b."]);

    await expect(
      db
        .insert(timelines)
        .values({ storyId: a.story.id, parentTimelineId: b.root.id }),
    ).rejects.toThrow();
  });

  it("rejects an edit whose target unit belongs to another story", async () => {
    const a = await createStoryWithUnits(db, "edit-a", "A", ["a."]);
    const b = await createStoryWithUnits(db, "edit-b", "B", ["b."]);

    const [child] = await db
      .insert(timelines)
      .values({ storyId: a.story.id, parentTimelineId: a.root.id })
      .returning({ id: timelines.id });

    await expect(
      db.insert(timelineEdits).values({
        storyId: a.story.id,
        timelineId: child.id,
        targetUnitId: b.units[0].id,
        scopeType: "unit",
        operation: "replace",
        selectedText: "b.",
        replacementText: "x.",
        parentTextHash: "hash",
      }),
    ).rejects.toThrow();
  });
});
