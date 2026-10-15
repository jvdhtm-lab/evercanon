import { resolve } from "node:path";

import postgres from "postgres";

import { createDatabase, type Connection } from "@/db/factory";
import { runMigrations } from "@/db/migrations";
import { runSeed } from "@/db/seed";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests need a disposable database.",
    );
  }
  return url;
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsafe test database name: ${dbName}`);
  }
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/**
 * Rebuilds the disposable test database from scratch: drop `public`, apply all
 * reviewed migrations from zero, then seed. Mirrors the CI schema-from-zero check.
 */
export async function migrateAndSeed(): Promise<void> {
  const url = testDatabaseUrl();
  await ensureDatabaseExists(url);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await runMigrations(sql, resolve(process.cwd(), "db/migrations"));
    await runSeed(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function createTestDatabase(): Connection {
  return createDatabase(testDatabaseUrl());
}
