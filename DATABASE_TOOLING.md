# Database tooling decision

## Decision

Use **PostgreSQL + Drizzle ORM + reviewed SQL migrations**. Do not use Prisma for this project.

Drizzle provides typed TypeScript database access while leaving PostgreSQL's relational constraints explicit. Its schema API supports multi-column foreign keys and partial indexes, but the application must still preserve the exact database contract and test the actual migrated schema.

## Why this fits Evercanon

The reference schema intentionally uses constraints that matter to correctness:

- `timelines.story_id` references `stories.id` and also participates in the composite self-reference `(parent_timeline_id, story_id) -> timelines(id, story_id)`. This prevents a timeline from choosing a parent belonging to another story.
- `timeline_edits` and `vote_targets` use composite foreign keys to ensure referenced timeline/unit rows belong to the same story.
- `one_root_timeline_per_story` is a partial unique index: one root per story, while any number of non-root children are allowed.
- The `direct_vote_target_scores` view supplies a correctness-first score calculation.

These constraints must remain database-enforced where the schema declares them. Do not remove, weaken, or duplicate them only in application validation to accommodate an ORM.

## Migration rules

1. **Committed, versioned SQL migrations are the canonical schema-evolution path.** Each change is code-reviewed and applied in development, CI, staging, and production in order.
2. Use Drizzle's table definitions for application types and query ergonomics. Keep them aligned with the schema created by migrations.
3. Use Drizzle declarations for ordinary columns, composite foreign keys, checks, indexes, and partial indexes where they generate the intended DDL clearly. Use explicit SQL migration statements for views, extensions, or anything not fully expressible.
4. Never rely on `drizzle-kit push` to change a production database. Never run destructive schema synchronization in production.
5. Do not introduce Prisma, a second ORM, or a second competing migration history.
6. SQL migrations must be idempotent only where appropriate; prefer ordered migration files with explicit up-only changes rather than pretending every migration can safely be replayed against an already-migrated database.
7. Before merging a schema change, CI must create a fresh PostgreSQL database, apply every migration from zero, run seeds where appropriate, run integration tests, and check important constraints.
8. Test constraints by attempting invalid writes directly against PostgreSQL—for example, a child timeline referencing a parent from another story must fail. Application-layer tests alone are insufficient.

## Required Phase 0 artifacts

- `src/db/schema.ts`: Drizzle table definitions/types mirroring the real schema.
- `src/db/client.ts`: server-only database client and connection handling.
- `db/migrations/`: committed SQL migrations.
- documented migration, seed, test, and reset commands; reset must be clearly development-only.
- Docker Compose with both the application and PostgreSQL containers once the app scaffold exists.

## Verification references

- Drizzle indexes and constraints: https://orm.drizzle.team/docs/indexes-constraints
- Prisma's current partial index feature history (included here to explain why partial indexes alone are not the deciding issue): https://www.prisma.io/changelog/2026-02-11
