import "server-only";

import { createDatabase, type Connection } from "./factory";

declare global {
  // Reuse a single pool across hot reloads in development.
  var __evercanonDb: Connection | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

/**
 * Returns the shared database connection. Created lazily so that importing this
 * module (for example during `next build`) never opens a connection.
 */
export function getConnection(): Connection {
  if (!global.__evercanonDb) {
    global.__evercanonDb = createDatabase(connectionString());
  }
  return global.__evercanonDb;
}

export function getDb() {
  return getConnection().db;
}

export function getSql() {
  return getConnection().client;
}

export type Database = ReturnType<typeof getDb>;
