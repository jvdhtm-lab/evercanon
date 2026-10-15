# Coding-agent prompts for Evercanon

Use one prompt at a time. Give the agent this project folder/repository. Ask it to read `README.md`, `BRAND.md`, `DATA_MODEL.md`, and `PROJECT_PLAN.md` first. Keep a Git checkpoint after every accepted phase.

## Persistent instruction (prepend to every phase)

> You are implementing Evercanon. Read the project docs before coding and inspect the actual repository before changing architecture. Implement only the requested phase and meet its acceptance gate. PostgreSQL is the source of truth. Use Drizzle ORM for typed TypeScript access, with reviewed/versioned SQL migrations as the canonical schema evolution path. Never weaken database constraints to satisfy the ORM; never add Prisma. Preserve immutable timeline history: popularity determines visibility, never existence. Do not use IP addresses as visitor identity; do not use browser fingerprinting. Treat submitted text as plain text. Never trust IDs, scores, offsets, target keys, or ownership data sent by the browser. Keep direct vote state separate from derived support. Cache and score projections must be rebuildable and must never become the only copy of authoritative data. Use transactions for related writes. Do not add Redis, queues, microservices, or other infrastructure without a documented need. If something is ambiguous, choose the simplest consistent behavior and record it in `docs/decisions.md`. Write tests and run the appropriate checks. Report only checks actually run and their actual outcomes. Stop at the requested phase; do not skip ahead.

## Phase 0 — inspect and prepare

> Perform Phase 0 only from `PROJECT_PLAN.md`. Inspect the repo and report its framework, package manager, tests, deployment assumptions, and constraints. If empty, scaffold Next.js + TypeScript + Drizzle + Tailwind + Vitest + Playwright. Add a multi-stage application Dockerfile and Docker Compose services for both `app` and `postgres`; use a named PostgreSQL volume, health checks, and app readiness handling. Add the implementation contract, SQL migration workflow, `.env.example`, and documented commands. SQL migrations are canonical; keep Drizzle type definitions synchronized with the migrated database. Do not implement editing or voting. Run setup checks and report actual results.

## Phase 1 — PostgreSQL and read-only story

> Implement Phase 1 only. Create reviewed SQL migrations and matching Drizzle table/type definitions for stories, stable seed units, and the root timeline. Seed the exact opening sentence via a repeatable command. Implement a deterministic, testable `renderTimeline` domain function and read-only UI backed by PostgreSQL. Do not hardcode story text in the UI. Do not implement branches/voting. Test empty database migration and seed flow, root rendering, ordering, and invalid/cross-story IDs. Stop at Phase 1's gate.

## Phase 2 — immutable sentence branches

> Implement Phase 2 only. Add timeline children and one whole-unit replacement patch per non-root timeline. Create timeline and edit atomically in one PostgreSQL transaction. Render ancestor patches root-to-leaf, interpreting each patch against its own parent's rendering. Add stable timeline URLs and history. Reject stale parent text/hash and validate that the edit target belongs to the story. Ensure a timeline cannot change parent after creation. Test sibling branches, descendants, retries/idempotency, invalid ownership, and root immutability. Stop at the Phase 2 gate.

## Phase 3 — anonymous votes

> Implement Phase 3 only. Add a random opaque visitor UUID in a signed `HttpOnly`, `SameSite=Lax` cookie; add branch vote targets and a PostgreSQL `votes` table unique on visitor + target. Support upvote, downvote, change, and clear. The `votes` table is current vote state, not an immutable event ledger. Calculate scores from PostgreSQL; do not accept score values from clients. Add request validation, origin/CSRF protection, and conservative rate limits. No IP identity or invasive fingerprinting. Test repeated and concurrent requests and independent cookies behind a shared IP. Stop at the Phase 3 gate.

## Phase 4 — preferred path and navigation

> Implement Phase 4 only. Calculate the default reading path by walking from root and selecting each highest-ranked child: net score descending, upvotes descending, creation time ascending, UUID ascending. Use only the score policy documented in `DATA_MODEL.md`; do not award ancestor branches every descendant vote. Build a readable story interface and alternative panel on hover/tap/keyboard focus. Include stable branch URLs and accessible navigation. Add domain and Playwright tests. Stop at the Phase 4 gate.

## Phase 5 — word/phrase variants and attributions

> Implement Phase 5 only. Add sentence, word, and phrase vote targets bound to the selected timeline rendering. Store span patches with zero-based UTF-16 offsets, selected text, and parent text hash. Validate that offsets are valid and do not split surrogate pairs; reject stale selections. Implement derived support for contained/containing selected targets as a rebuildable projection. Do not create extra direct vote rows or recursively propagate attributions. Test Swedish text, emoji, combining marks, punctuation, repeated words, nested edits, and branch isolation. Stop at the Phase 5 gate.

## Phase 6 — insertions, deletion, moderation, concurrency

> Implement Phase 6 only. Design insertion/deletion so new content that may be edited later receives stable identity and is visible only on its introducing timeline and descendants. Do not rely only on global document offsets. Add text limits and validation, reporting and auditable moderation, transaction/concurrency protection, and spam mitigation. Preserve all historical revisions. Test that insertion/deletion stays branch-local, unsafe HTML is not executed, votes are consistent under concurrency, and moderation never silently rewrites text. Stop at the Phase 6 gate.

## Phase 7 — deploy and recover

> Implement Phase 7 only. Prepare a simple public beta deployment with environment secrets, HTTPS/reverse proxy, health checks, structured safe logs, off-site PostgreSQL backups, retention policy, and a documented restore procedure. Test restore into a separate database. Add production-like end-to-end smoke tests and baseline load tests for deep branches, hot voting targets, and concurrent submissions. Record data size, hardware, p50/p95 latency, error rate, and database load. Do not add infrastructure just to look scalable. Stop at the Phase 7 gate.

## Phase 8 — scale only when measurements justify it

> Implement Phase 8 only if baseline measurements identify a bottleneck. Use query plans and realistic load to select a remedy. Possible options are immutable timeline snapshots/checkpoints, a rebuildable vote-score projection, Redis, worker queues, managed PostgreSQL, or read replicas. Do not implement all of them by default. Preserve PostgreSQL source-of-truth records. Add a rebuild/reconciliation command and tests comparing all derived data with authoritative data. Demonstrate a measured improvement and update runbooks. If no meaningful bottleneck exists, document the evidence and do not add complexity.

## Suggested development loop

1. Give the persistent instruction and one phase prompt.
2. Review the diff before accepting it.
3. Run the documented acceptance checks yourself where possible.
4. Fix defects inside the current phase.
5. Commit a checkpoint such as `evercanon: complete phase 2 branching`.
6. Move on only after the gate passes.
