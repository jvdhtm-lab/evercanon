import type { Sql } from "postgres";

/**
 * Idempotent seed entry point. Safe to run repeatedly.
 *
 * Phase 0 has no story tables yet, so this is intentionally a no-op. Phase 1
 * seeds the opening story, stable units, and the root timeline here.
 */
export async function runSeed(sql: Sql): Promise<void> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stories'
  `;
  const hasStories = rows[0]?.count !== "0";

  if (!hasStories) {
    console.log("seed: no story tables yet (nothing to seed before Phase 1)");
    return;
  }

  console.log("seed: story tables detected but seeding is not implemented yet");
}
