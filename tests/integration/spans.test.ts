import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Connection } from "@/db/factory";
import { renderToPlainText } from "@/domain/render";
import {
  InvalidSpanError,
  proposeSpanReplacement,
  proposeUnitReplacement,
  StaleEditError,
} from "@/services/proposals";
import { renderTimeline } from "@/services/timeline";

import { createTestDatabase, migrateAndSeed } from "./helpers/db";
import { createStoryWithUnits } from "./helpers/fixtures";

let conn: Connection;
let db: Connection["db"];

async function renderText(storyId: string, timelineId: string): Promise<string> {
  return renderToPlainText((await renderTimeline(db, storyId, timelineId)).units);
}

beforeAll(async () => {
  await migrateAndSeed();
  conn = createTestDatabase();
  db = conn.db;
});

afterAll(async () => {
  await conn.client.end({ timeout: 5 });
});

describe("span proposals", () => {
  it("replaces only the selected span and leaves the root unchanged", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-${randomUUID()}`,
      "Span",
      ["The cat sat."],
    );

    const child = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      startOffset: 4,
      endOffset: 7,
      selectedText: "cat",
      replacementText: "dog",
    });

    expect(await renderText(story.id, child.timelineId)).toBe("The dog sat.");
    expect(await renderText(story.id, root.id)).toBe("The cat sat.");
  });

  it("rejects a stale selected text", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-stale-${randomUUID()}`,
      "SpanStale",
      ["Hello world"],
    );

    await expect(
      proposeSpanReplacement(db, {
        storyId: story.id,
        parentTimelineId: root.id,
        targetUnitId: units[0].id,
        startOffset: 6,
        endOffset: 11,
        selectedText: "there",
        replacementText: "earth",
      }),
    ).rejects.toBeInstanceOf(StaleEditError);
  });

  it("rejects a span that splits a surrogate pair", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-emoji-${randomUUID()}`,
      "SpanEmoji",
      ["a\u{1F600}b"],
    );

    await expect(
      proposeSpanReplacement(db, {
        storyId: story.id,
        parentTimelineId: root.id,
        targetUnitId: units[0].id,
        startOffset: 2,
        endOffset: 3,
        selectedText: "b",
        replacementText: "c",
      }),
    ).rejects.toBeInstanceOf(InvalidSpanError);
  });

  it("replaces the correct occurrence of a repeated word", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-repeat-${randomUUID()}`,
      "SpanRepeat",
      ["the cat and the dog"],
    );

    const second = "the cat and the dog".indexOf("the", 4);
    const child = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      startOffset: second,
      endOffset: second + 3,
      selectedText: "the",
      replacementText: "a",
    });

    expect(await renderText(story.id, child.timelineId)).toBe("the cat and a dog");
  });

  it("applies nested edits against each edit's own parent", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-nested-${randomUUID()}`,
      "SpanNested",
      ["The quick brown fox"],
    );

    // Unit replacement on the first child.
    const first = await proposeUnitReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      selectedText: "The quick brown fox",
      replacementText: "A quick brown dog",
    });
    expect(await renderText(story.id, first.timelineId)).toBe("A quick brown dog");

    // Span edit on the child's rendering (offsets relative to the child).
    const second = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: first.timelineId,
      targetUnitId: units[0].id,
      startOffset: 2,
      endOffset: 7,
      selectedText: "quick",
      replacementText: "swift",
    });
    expect(await renderText(story.id, second.timelineId)).toBe("A swift brown dog");
    expect(await renderText(story.id, first.timelineId)).toBe("A quick brown dog");
    expect(await renderText(story.id, root.id)).toBe("The quick brown fox");
  });

  it("keeps sibling span edits isolated", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-siblings-${randomUUID()}`,
      "SpanSiblings",
      ["One two three"],
    );

    const a = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      startOffset: 0,
      endOffset: 3,
      selectedText: "One",
      replacementText: "Uno",
    });
    const b = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      startOffset: 0,
      endOffset: 3,
      selectedText: "One",
      replacementText: "Ein",
    });

    expect(await renderText(story.id, a.timelineId)).toBe("Uno two three");
    expect(await renderText(story.id, b.timelineId)).toBe("Ein two three");
    expect(await renderText(story.id, root.id)).toBe("One two three");
  });

  it("handles Swedish characters", async () => {
    const { story, units, root } = await createStoryWithUnits(
      db,
      `span-sv-${randomUUID()}`,
      "SpanSwedish",
      ["Fåglarna äter frön."],
    );

    const start = "Fåglarna äter frön.".indexOf("äter");
    const child = await proposeSpanReplacement(db, {
      storyId: story.id,
      parentTimelineId: root.id,
      targetUnitId: units[0].id,
      startOffset: start,
      endOffset: start + 4,
      selectedText: "äter",
      replacementText: "ser",
    });
    expect(await renderText(story.id, child.timelineId)).toBe("Fåglarna ser frön.");
  });
});
