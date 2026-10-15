import type { Sql } from "postgres";

export const SEED_STORY_SLUG = "the-beginning";
export const SEED_STORY_TITLE = "The Beginning";
export const SEED_SENTENCE =
  "In the beginning, in the yard of angels, there were twelve dwarves and one irrational number.";

/**
 * Idempotent seed. Safe to run repeatedly: existing story, unit text, and root
 * timeline are preserved (seed-unit content is immutable), and a missing root is
 * created.
 */
export async function runSeed(sql: Sql): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO stories (slug, title)
      VALUES (${SEED_STORY_SLUG}, ${SEED_STORY_TITLE})
      ON CONFLICT (slug) DO NOTHING
    `;

    const [story] = await tx<{ id: string }[]>`
      SELECT id FROM stories WHERE slug = ${SEED_STORY_SLUG}
    `;
    if (!story) throw new Error("seed: failed to create or find the seed story");
    const storyId = story.id;

    await tx`
      INSERT INTO story_units (story_id, position, unit_type, initial_text)
      VALUES (${storyId}, 0, 'sentence', ${SEED_SENTENCE})
      ON CONFLICT (story_id, position) DO NOTHING
    `;

    await tx`
      INSERT INTO timelines (story_id, parent_timeline_id, label)
      SELECT ${storyId}, NULL, 'seed'
      WHERE NOT EXISTS (
        SELECT 1 FROM timelines
        WHERE story_id = ${storyId} AND parent_timeline_id IS NULL
      )
    `;

    await tx`
      UPDATE stories SET seeded_at = now()
      WHERE id = ${storyId} AND seeded_at IS NULL
    `;
  });

  console.log("seed: ensured opening story, seed unit, and root timeline");
}
