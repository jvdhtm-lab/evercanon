import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { timelineEdits } from "@/db/schema";
import { TimelineNotFoundError } from "@/domain/errors";
import { renderToPlainText } from "@/domain/render";
import {
  proposeUnitReplacement,
  StaleEditError,
  TargetUnitNotFoundError,
} from "@/services/proposals";
import { renderTimeline } from "@/services/timeline";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

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

describe("proposeUnitReplacement", () => {
  it("creates sibling branches without changing the root", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      "siblings",
      "Siblings",
      ["Original sentence."],
    );

    const a = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Original sentence.",
      replacementText: "First alternative.",
    });
    const b = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Original sentence.",
      replacementText: "Second alternative.",
    });

    expect(a.timelineId).not.toBe(b.timelineId);
    expect(
      renderToPlainText((await renderTimeline(db, story.id, a.timelineId)).units),
    ).toBe("First alternative.");
    expect(
      renderToPlainText((await renderTimeline(db, story.id, b.timelineId)).units),
    ).toBe("Second alternative.");
    expect(
      renderToPlainText((await renderTimeline(db, story.id, root.id)).units),
    ).toBe("Original sentence.");
  });

  it("inherits ancestor patches and only changes the targeted unit", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      "inherit",
      "Inherit",
      ["One.", "Two."],
    );

    const a = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "One.",
      replacementText: "ONE.",
    });
    const b = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: a.timelineId,
      targetUnitId: units[1].id,
      selectedText: "Two.",
      replacementText: "TWO.",
    });

    const rendered = await renderTimeline(db, story.id, b.timelineId);
    expect(renderToPlainText(rendered.units)).toBe("ONE. TWO.");
    expect(rendered.pathTimelineIds).toEqual([
      root.id,
      a.timelineId,
      b.timelineId,
    ]);
  });

  it("rejects a stale selectedText", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      "stale",
      "Stale",
      ["Fresh text."],
    );

    await expect(
      proposeUnitReplacement(db, {
        storyId: story.id,
        parentTimelineId: root.id,
        targetUnitId: units[0].id,
        selectedText: "Old text.",
        replacementText: "New.",
      }),
    ).rejects.toBeInstanceOf(StaleEditError);
  });

  it("is idempotent for a repeated request key", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      "idempotent",
      "Idempotent",
      ["Text."],
    );
    const requestKey = "11111111-1111-1111-1111-111111111111";

    const first = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Text.",
      replacementText: "Changed.",
      requestKey,
    });
    const second = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "Text.",
      replacementText: "Changed.",
      requestKey,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.timelineId).toBe(first.timelineId);

    const rows = await db
      .select({ id: timelineEdits.id })
      .from(timelineEdits)
      .where(eq(timelineEdits.requestKey, requestKey));
    expect(rows).toHaveLength(1);
  });

  it("rejects a parent timeline from another story", async () => {
    const a = await createStoryWithUnits(db, "owner-a", "A", ["A text."]);
    const b = await createStoryWithUnits(db, "owner-b", "B", ["B text."]);

    await expect(
      proposeUnitReplacement(db, {
        storyId: a.story.id,
        parentTimelineId: b.root.id,
        targetUnitId: a.units[0].id,
        selectedText: "A text.",
        replacementText: "X.",
      }),
    ).rejects.toBeInstanceOf(TimelineNotFoundError);
  });

  it("rejects a target unit that is not in the story", async () => {
    const a = await createStoryWithUnits(db, "unit-a", "A", ["A text."]);
    const b = await createStoryWithUnits(db, "unit-b", "B", ["B text."]);

    await expect(
      proposeUnitReplacement(db, {
        storyId: a.story.id,
        parentTimelineId: a.root.id,
        targetUnitId: b.units[0].id,
        selectedText: "B text.",
        replacementText: "X.",
      }),
    ).rejects.toBeInstanceOf(TargetUnitNotFoundError);
  });
});
