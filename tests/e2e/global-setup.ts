import { resolve } from "node:path";

import { config } from "dotenv";
import postgres from "postgres";

import { runMigrations } from "../../src/db/migrations";
import { runSeed } from "../../src/db/seed";

/**
 * Resets the development database to a known state before end-to-end tests:
 * empty schema, all migrations, and the seed story. This keeps e2e assertions
 * deterministic regardless of earlier manual use.
 */
export default async function globalSetup(): Promise<void> {
  config();

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set to run end-to-end tests");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await runMigrations(sql, resolve(process.cwd(), "db/migrations"));
    await runSeed(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
