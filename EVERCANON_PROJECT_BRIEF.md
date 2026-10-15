# Evercanon — project brief for coding agents

**Tagline:** *Nothing is final. Everything leaves a trace.*  
**Core rule:** **Popularity determines visibility, never existence.**

## Goal

Build a public collaborative story. Each accepted contribution creates a new timeline branch. Visitors can propose changes and vote without registering. The preferred branch at each fork is shown by default; all non-moderated alternatives remain readable, shareable, and extendable.

## Seed sentence

“In the beginning, in the yard of angels, there were twelve dwarves and one irrational number.”

## Stack

Next.js App Router + TypeScript, PostgreSQL, Drizzle ORM for typed queries, reviewed SQL migrations as the schema-change source of truth, Tailwind, Vitest, Playwright. Inspect an existing repo before changing its stack. Dockerize both the app and PostgreSQL with Docker Compose. One app and one DB first; no Redis/queues/microservices until measurements justify them.

## Data model

- `stories`: work and stable slug.
- `visitors`: pseudonymous visitor UUID from a signed `HttpOnly`, `SameSite=Lax` cookie; never IP identity.
- `story_units`: stable anchors for seed text, initially one sentence each.
- `timelines`: immutable tree nodes with a parent in the same story; one root per story.
- `timeline_edits`: one patch per non-root timeline; patch + timeline created in one transaction.
- `vote_targets`: branch/sentence/phrase/word targets bound to one timeline rendering.
- `votes`: current `+1`/`-1` state, unique per visitor and target; it can be changed or cleared and is not an append-only event log.
- `vote_attributions`: derived, rebuildable support for related contained/containing text targets, never extra vote events.
- Optional `timeline_render_snapshots` and `vote_score_projection`: derived, rebuildable optimization data; use only when measurement justifies.

## Required behavior

- Accepted edits never overwrite their parent.
- Sibling proposals remain sibling timelines; do not auto-merge.
- Preferred path is resolved from the root by ranking each child on that child's branch target: net score descending, upvotes descending, earlier creation time, then UUID. Do not sum descendant votes into every ancestor.
- Low popularity never deletes a branch.
- Word/phrase offsets refer to the parent timeline's rendered text, use zero-based UTF-16 code-unit offsets to match browser selections, and are validated with selected text/hash and Unicode-boundary checks.
- User text is plain text, never executable HTML.
- Keep database backups away from the app server and test restores.

## Agent workflow

Read `README.md`, `BRAND.md`, `DATA_MODEL.md`, and `PROJECT_PLAN.md`. Implement one phase and its gate at a time. Run tests/lint/typecheck/build and report actual results. Do not claim success without running checks.
