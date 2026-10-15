# Evercanon phased implementation plan

Build one phase at a time. Do not begin the next phase until the current validation gate passes. Keep one deployable app and one PostgreSQL database until measured requirements justify more. Run the app and the database as separate Docker containers coordinated by Docker Compose, rather than bundling them into a single image.

## Phase 0 — repository reconnaissance and contract

**Goal:** understand the existing repository and produce a reproducible, containerized development setup.

Tasks:
- Inspect framework, package manager, existing tests, deployment files, and conventions before changing architecture.
- If empty, scaffold Next.js App Router + TypeScript, PostgreSQL, Prisma, Tailwind, Vitest, and Playwright.
- Run the **Next.js app and PostgreSQL as two separate Docker containers coordinated by one `docker-compose.yml`**: a `postgres` service and an `app` service built from the repo `Dockerfile`. The app must reach the database by Compose service name (`postgres`), not `localhost`, and must wait for the database healthcheck before starting.
- Add project docs and implementation contract; document commands for install, dev, lint, typecheck, test, migration, seed, build, and `docker compose up`.
- Add `.env.example` covering both services; keep secrets out of images and version control.
- Record architectural choices (including the two-container topology) in `docs/decisions.md`.
- Explain that cookie-based voting is pseudonymous and not Sybil-proof.

**Gate:** a clean checkout can install dependencies, build the app image, start the `app` and `postgres` containers together with `docker compose up`, run migrations/seed against the containerized database, and pass its setup checks. No timeline editing or voting yet.

## Phase 1 — PostgreSQL seed and read-only renderer

**Goal:** render the seed story from PostgreSQL, not hardcoded UI text.

Tasks:
- Add stories, stable seed units, and a root timeline using a repeatable migration and seed command.
- Implement a pure, deterministic `renderTimeline(storyId, timelineId)` domain function.
- Build a basic read-only page and stable timeline URL.
- Add integration tests against PostgreSQL.

**Gate:** empty DB migrates and seeds from documented commands; page reads seed text from DB; renderer rejects non-existent or cross-story IDs; unit ordering is deterministic.

## Phase 2 — immutable sentence-level branches

**Goal:** every accepted contribution creates a new child timeline without overwriting history.

Tasks:
- Add timelines and one whole-unit replacement patch per non-root timeline.
- Create timeline + edit in one DB transaction.
- Store selected parent text and hash; reject stale submissions.
- Add history, child-branch queries, and stable shareable timeline URLs.
- Add idempotency protection for duplicate submissions/retries where practical.

**Gate:** create two siblings from the root; each renders differently; root is unchanged; descendants inherit parent patches; invalid ownership/stale edits fail; retries do not create accidental duplicates.

## Phase 3 — anonymous voting

**Goal:** support upvote/downvote without mandatory registration.

Tasks:
- Issue a random opaque visitor UUID in a signed `HttpOnly`, `SameSite=Lax` cookie.
- Add branch vote targets and `votes` unique on `(visitor_id, vote_target_id)`.
- Support vote, change vote, and clear vote; read scores from PostgreSQL on the server.
- Add request validation, same-origin/CSRF protection suited to the framework, and conservative rate limits.
- Never use IP as identity; do not add invasive fingerprinting.

**Gate:** repeated/concurrent clicks cannot create duplicate votes; distinct cookies can vote independently behind one shared IP; a cookie preserves current vote state; score matches the vote rows.

## Phase 4 — preferred timeline and alternative exploration

**Goal:** display the currently preferred path and let people explore branches.

Tasks:
- Resolve the preferred path by applying the documented deterministic ranking rule at each fork.
- Show alternatives on hover (desktop), tap (touch), and keyboard focus; maintain accessible focus and escape behavior.
- Add navigation to a timeline by stable URL and a way back to the preferred story.
- Add query plans/measurements for preferred-path and child-branch reads.

**Gate:** deterministic tie-breaking tests pass; alternative URLs load; keyboard/mobile interactions work; Playwright covers reading, voting, and branch exploration.

## Phase 5 — word/phrase spans and derived support

**Goal:** let readers propose and vote on alternatives within a sentence.

Tasks:
- Add server-validated word/phrase/sentence targets tied to a timeline rendering.
- Implement span edits using parent-rendered UTF-16 offsets, selected text, and parent text hash; validate Unicode boundaries.
- Add derived attribution from sentence votes to contained selected word/phrase targets and from word/phrase votes to containing targets.
- Keep attribution separate from the direct vote table; make it idempotent and rebuildable.

**Gate:** Unicode, punctuation, repeated word, stale selection, nested edit, and branch-isolation tests pass; one direct vote remains one vote row; no recursive attribution multiplication.

## Phase 6 — insertion/deletion, moderation, and concurrency

**Goal:** extend content operations without corrupting text or history.

Tasks:
- Design insertion/deletion with stable IDs for any new content that must be editable later; do not model inserted text as a permanent character offset alone.
- Add limits for text length, whitespace-only input, and allowed content.
- Add reports and auditable moderation actions separate from ranking. Preserve text/history; moderate display, not history.
- Add optimistic concurrency, transaction/retry handling, and spam protections.

**Gate:** inserted content has stable identity on its branch and descendants; deletion can be reversed by branching from an earlier timeline; concurrent votes/edits are safe; user text cannot execute as HTML; moderation is auditable.

## Phase 7 — public beta and operational durability

**Goal:** launch on a simple VPS or equivalent with safe recovery.

Tasks:
- Complete loading, empty, error, and not-found states; responsive layout and accessibility.
- Add structured logs, request IDs, health checks, and error reporting without logging visitor secrets.
- Deploy the app and PostgreSQL as separate containers coordinated by Docker Compose on the single host; the production image must not depend on a bind-mounted source tree.
- Add HTTPS/reverse proxy, environment secrets, database migration/runbook, automated off-site backups, retention, and restore tests.
- Add end-to-end smoke tests against a production-like deployment.
- Run a baseline load test covering a deep timeline, hot branch, and concurrent votes. Record environment, data size, p50/p95 latency, errors, and DB load.

**Gate:** production build and smoke tests pass; a maintainer can deploy, migrate, back up, and restore from documentation; backup recovery is demonstrated.

## Phase 8 — evidence-driven scale hardening (only when needed)

**Goal:** optimize based on measured bottlenecks, not guesses.

Tasks, only where measurements warrant them:
- Add timeline render snapshots/checkpoints for deep or frequently visited branches. Find the nearest ancestor snapshot and apply only remaining descendant patches.
- Add a rebuildable vote-score projection if the direct-score view is expensive; verify projections against source vote rows.
- Add Redis, a background worker/queue, read replicas, or managed PostgreSQL only if measured need justifies operational cost.
- Use `EXPLAIN (ANALYZE, BUFFERS)` and realistic data distributions before changing indexes or query structure.
- Define cache invalidation/version rules and a rebuild command; keep authoritative history in PostgreSQL.

**Gate:** before/after benchmark demonstrates a measurable improvement; correctness tests compare cached/projected results with authoritative data; projected/cached data is rebuildable; deployment/restore docs are updated.

## Testing strategy

Tests described in Markdown do not protect the application until the agent implements and runs them. Every phase must add and run the tests relevant to the behavior it introduces.

| Test layer | What we verify |
| --- | --- |
| Unit tests — Vitest | Timeline rendering, branch ranking, deterministic tie-breaking, Unicode text editing |
| Integration tests — PostgreSQL | Migrations, branching, immutable history, votes, transactions and concurrent submissions |
| End-to-end tests — Playwright | Read the story, edit a phrase, vote, hover to explore alternatives, open a shared timeline |
| Security tests | Duplicate votes, invalid edits, stale selections, input validation, and anonymous visitors sharing an IP |
| Backup and recovery tests | Restore PostgreSQL into a separate database and verify that stories, branches and votes survive |
| Load tests | Deep timelines, heavily contested branches and concurrent voting |

## How the coding agent should work

Every phase must follow this cycle:

1. Implement one phase.
2. Write the relevant tests.
3. Run the tests and inspect failures.
4. Run lint, type checking and the production build where applicable.
5. Fix failures before proceeding.
6. Report the actual results and stop at the phase's acceptance gate.

## Definition of done for every phase

- Business logic lives in tested domain/service functions, not only in UI components.
- Related DB writes use transactions.
- Relevant automated tests and manual acceptance checks run.
- Lint, typecheck, tests, and production build are reported accurately.
- The agent lists changed files, commands and actual results, incomplete items, risks, and a suggested Git checkpoint.
- The agent stops at the current phase's gate instead of jumping ahead.
