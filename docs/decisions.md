# Architecture decisions

## ADR-001 — Drizzle ORM with reviewed SQL migrations

**Status:** accepted (Phase 0)

Use PostgreSQL as the source of truth, Drizzle ORM for typed queries, and
versioned, hand-reviewed SQL files in `db/migrations/` as the canonical
schema-evolution path. Do not use Prisma, and do not use `drizzle-kit push`
against production. See `DATABASE_TOOLING.md` for the full policy.

Rationale: the schema relies on constraints and objects that must be exact —
composite self-referencing foreign keys, partial unique indexes (`one root
timeline per story`), check constraints, and the `direct_vote_target_scores`
view. Keeping the DDL in reviewed SQL keeps those guarantees explicit rather
than approximating them through an ORM.

## ADR-002 — Two containers coordinated by Docker Compose

**Status:** accepted (Phase 0)

The Next.js app and PostgreSQL run as **separate containers** in one
`docker-compose.yml`:

- `postgres` — `postgres:16-alpine`, named volume `evercanon_postgres_data`,
  health check via `pg_isready`.
- `migrate` — one-shot job built from the `migrator` Dockerfile stage; runs
  `db:migrate` then `db:seed` and exits.
- `app` — production image built from the `runner` stage; starts only after
  `postgres` is healthy and `migrate` completed successfully.

The app reaches the database by Compose **service name** (`postgres`), never
`localhost`. PostgreSQL is published only on `127.0.0.1` for development and is
not exposed publicly in production.

## ADR-003 — Lazy, server-only database client

**Status:** accepted (Phase 0)

`src/db/client.ts` imports `server-only` and creates the `postgres.js` pool
lazily on first use. This prevents `next build` from opening a database
connection and keeps credentials out of client bundles. A single pool is cached
on `globalThis` to survive development hot reloads.

## ADR-004 — Immutable migration history with checksums

**Status:** accepted (Phase 0)

`runMigrations` records each applied file and its SHA-256 checksum in
`schema_migrations`. Re-running skips applied files; editing an already-applied
migration is an error, so schema history stays append-only. Each migration runs
in a transaction with its bookkeeping row.

## ADR-005 — Next.js standalone output

**Status:** accepted (Phase 0)

`next.config.ts` sets `output: "standalone"` so the production image ships only
the traced server bundle plus static assets, running as a non-root user.

## ADR-006 — Anonymous identity is a signed cookie

**Status:** planned (Phase 3)

Visitors are identified by a random opaque UUID in a signed, `HttpOnly`,
`SameSite=Lax` cookie. An IP address is never used as identity and people behind
a shared IP are never merged. Cookie identity is a lightweight duplicate-vote
guard, not proof of one human per vote; the site states this openly.
