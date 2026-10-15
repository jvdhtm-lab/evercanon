import { resolve } from "node:path";

import { config } from "dotenv";
import postgres from "postgres";

import { runMigrations } from "../src/db/migrations";

config();

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const { applied, skipped } = await runMigrations(
      sql,
      resolve(process.cwd(), "db/migrations"),
    );
    for (const file of skipped) console.log(`= skip    ${file}`);
    for (const file of applied) console.log(`+ applied ${file}`);
    console.log(
      `migrate: done (${applied.length} applied, ${skipped.length} skipped)`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("migrate failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
