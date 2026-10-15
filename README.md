# Evercanon — agent-ready project

**Tagline:** *Nothing is final. Everything leaves a trace.*

**Product principle:** **Popularity determines visibility, never existence.**

Evercanon is a public collaborative story. Every accepted contribution creates a new immutable timeline branch. Visitors can vote without creating an account. The default story follows the preferred branch at each fork, while alternative timelines remain accessible, shareable, and extendable.

## Start here

1. Read `EVERCANON_PROJECT_BRIEF.md` for the concise implementation contract.
2. Read `DATA_MODEL.md` before designing database or rendering code.
3. Follow `PROJECT_PLAN.md` one phase at a time.
4. Give the matching prompt from `AGENT_PROMPTS.md` to your coding agent.
5. Use `schema.sql` as the target/reference schema, **not as a command to create every future feature in Phase 1**.

## Recommended stack

- Next.js App Router + TypeScript
- PostgreSQL as the authoritative data store
- Drizzle ORM for typed TypeScript database access, with reviewed SQL migrations as the authoritative schema-change history
- Tailwind CSS
- Vitest for unit/integration tests and Playwright for end-to-end tests
- Docker Compose for local PostgreSQL and a simple single-server first deployment

If a repository already exists, inspect it first and follow its established conventions unless a concrete reason to change them is documented. Do not replace a working stack just because this document suggests another one.

## Local PostgreSQL

The project pack starts with a PostgreSQL service in `docker-compose.yml` because the Next.js application has not been scaffolded yet. **Phase 0 must add the app `Dockerfile` and an `app` service to the same Compose file**, so both the application and PostgreSQL run in containers before feature work begins. Copy `.env.example` to `.env`, then start the database for initial setup:

```bash
docker compose up -d postgres
```

In Phase 0, the agent must document commands to start the whole stack, apply SQL migrations, seed the opening sentence, and run tests inside the reproducible Docker environment. Never commit `.env` or credentials.

## Seed sentence

> In the beginning, in the yard of angels, there were twelve dwarves and one irrational number.

Seed it through a repeatable database seed command. Do not hardcode it into the UI.

## Non-negotiable rules

- Reading and participation require no account in the MVP.
- Never use an IP address as a visitor identity or merge people because they share an IP. A random, opaque, signed `HttpOnly` cookie is a lightweight pseudonymous identity, not proof of one human per vote.
- Accepted timeline revisions and edit records are immutable. Corrections are new branches. Do not delete unpopular branches.
- One timeline node introduces one edit against its parent and inherits the rest of its parent's content.
- Competing proposals from the same parent are sibling timelines; do not auto-merge them.
- The preferred timeline is a deterministic walk from the root: select the highest-ranked child at each fork. Do not sum all descendant votes onto every ancestor.
- Direct vote state and derived support for words/phrases/sentences are different things. A vote attribution is not another vote event.
- All text is plain text, not HTML. Validate user input and escape it on output.
- Cache data and score projections are derived and rebuildable. PostgreSQL source records remain authoritative.
- Keep backup copies separate from the VPS and test restoring them.

## Database tooling policy

Use **Drizzle ORM** for typed database access in TypeScript and **versioned, reviewed SQL migration files** for schema changes. PostgreSQL is the authority for data integrity; do not weaken constraints to fit an ORM abstraction. The committed SQL migration history is the canonical path for schema evolution. Keep Drizzle table/type definitions aligned with the resulting database. Use Drizzle for composite foreign keys and partial indexes where the definitions stay clear; use explicit SQL migrations for the score view, extensions, or any constraint the tooling cannot represent exactly. Do not use `prisma`, `prisma migrate`, or `drizzle-kit push` against production. See `DATABASE_TOOLING.md`.

## Keep the first deployment simple

Start with one application, one PostgreSQL database, Docker Compose, HTTPS, rate limits, and automated off-site backups. Do not add Redis, a queue, microservices, or read replicas before the application has measurements showing they are needed.

The data model anticipates two optimizations without requiring them on day one:

1. **Rendered timeline checkpoints/snapshots** for deep or frequently visited branches.
2. **Rebuildable vote-score projections** if calculating scores directly from votes becomes measurably expensive.

Use the direct-score SQL view first. Promote snapshots/projections to active features only when thresholds and tests are documented.

## Files

- `BRAND.md` — identity, tagline, voice, and product philosophy.
- `DATA_MODEL.md` — entities, branch semantics, rendering, scoring, snapshot and cache strategy.
- `PROJECT_PLAN.md` — phases and acceptance gates.
- `AGENT_PROMPTS.md` — copy/paste prompts for a coding agent.
- `schema.sql` — PostgreSQL reference schema, including optional scale projections. Use it as the database contract when authoring versioned SQL migrations.
- `EVERCANON_PROJECT_BRIEF.md` — short standalone agent brief.
- `DATABASE_TOOLING.md` — Drizzle/SQL migration policy and schema invariants.
- `docker-compose.yml` and `.env.example` — PostgreSQL bootstrap; Phase 0 must add the containerized app service and Dockerfile.
- `scripts/backup-postgres.sh` — local backup helper; off-site upload must be configured separately.

## Definition of done

Do not accept “it works” without evidence. For each phase, require code changes, automated tests, the relevant manual check, lint/typecheck/build results, and a short report of incomplete items. The agent must never claim a test passed unless it actually ran it.
