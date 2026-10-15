import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Builds a postgres.js pool and a Drizzle client bound to it. Kept separate
 * from `client.ts` (which is server-only) so scripts and tests can create their
 * own connections without pulling in Next.js request context.
 */
export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, idle_timeout: 20 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Connection = ReturnType<typeof createDatabase>;
