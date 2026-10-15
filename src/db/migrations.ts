import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Sql } from "postgres";

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applies every pending `.sql` file in `migrationsDir` in lexical order.
 * Each file runs inside a transaction together with its bookkeeping row, so a
 * failure leaves the database on the previous migration. Already-applied files
 * are skipped, and a changed checksum is treated as an error.
 */
export async function runMigrations(
  sql: Sql,
  migrationsDir: string,
): Promise<MigrationResult> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const existing = await sql<{ name: string; checksum: string }[]>`
    SELECT name, checksum FROM schema_migrations
  `;
  const appliedBy = new Map(existing.map((row) => [row.name, row.checksum]));

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const contents = readFileSync(join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(contents).digest("hex");
    const previous = appliedBy.get(file);

    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(
          `Migration ${file} was modified after it was applied. ` +
            `Migrations are immutable; add a new migration instead.`,
        );
      }
      skipped.push(file);
      continue;
    }

    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO schema_migrations (name, checksum) VALUES (${file}, ${checksum})`;
    });
    applied.push(file);
  }

  return { applied, skipped };
}
