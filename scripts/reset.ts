import { resolve } from "node:path";

import { config } from "dotenv";
import postgres from "postgres";

import { runMigrations } from "../src/db/migrations";
import { runSeed } from "../src/db/seed";

config();

/**
 * DEVELOPMENT ONLY. Drops the entire `public` schema and rebuilds it from the
 * reviewed migrations plus seed. Refuses to run in production.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset is development-only and will not run in production");
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    console.log("reset: dropping schema public");
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const { applied } = await runMigrations(
      sql,
      resolve(process.cwd(), "db/migrations"),
    );
    for (const file of applied) console.log(`+ applied ${file}`);
    await runSeed(sql);
    console.log("reset: done");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
