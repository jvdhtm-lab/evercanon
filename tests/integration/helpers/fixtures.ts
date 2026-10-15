import type { Database } from "@/db/client";
import { stories, storyUnits, timelines } from "@/db/schema";

export interface StoryFixture {
  story: { id: string; slug: string; title: string };
  units: { id: string; position: number }[];
  root: { id: string };
}

/** Creates a fresh story with one unit per sentence and a root timeline. */
export async function createStoryWithUnits(
  db: Database,
  slug: string,
  title: string,
  sentences: string[],
): Promise<StoryFixture> {
  const [story] = await db.insert(stories).values({ slug, title }).returning();

  const units = await db
    .insert(storyUnits)
    .values(
      sentences.map((text, index) => ({
        storyId: story.id,
        position: index,
        unitType: "sentence" as const,
        initialText: text,
      })),
    )
    .returning({ id: storyUnits.id, position: storyUnits.position });

  const [root] = await db
    .insert(timelines)
    .values({ storyId: story.id, label: "seed" })
    .returning({ id: timelines.id });

  return { story, units, root };
}
