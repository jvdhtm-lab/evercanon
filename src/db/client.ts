import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;

declare global {
  // Reuse a single pool across hot reloads in development.
  var __evercanonSql: Sql | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

/**
 * Returns the shared postgres.js pool. Connections are created lazily so that
 * importing this module (for example during `next build`) does not open a
 * connection to the database.
 */
export function getSql(): Sql {
  if (!global.__evercanonSql) {
    global.__evercanonSql = postgres(connectionString(), {
      max: 10,
      idle_timeout: 20,
    });
  }
  return global.__evercanonSql;
}

/** Drizzle query builder bound to the shared pool. */
export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Database = ReturnType<typeof getDb>;
