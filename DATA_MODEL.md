# Evercanon data model and timeline semantics

## 1. Core rule

**Popularity determines visibility, never existence.** The preferred path is a computed reading default. Every non-moderated alternative remains addressable, readable, and extendable by stable URL. Never prune a branch because of age, low votes, or popularity. Safety/legal moderation is separate and auditable; it may restrict public display but must not silently rewrite history.

## 2. Model a timeline as an immutable tree node

A timeline is one state in a story's version tree. The root renders the seed text. Every non-root timeline introduces exactly one patch against its parent and inherits all other content through that parent. Two proposals from the same parent are sibling realities. There is no automatic merge. To combine two changes, a contributor opens one branch and proposes the other change on that branch.

This tree model is simpler and easier to reason about than a multi-parent merge DAG. Do not add merge semantics to the MVP.

## 3. Entities

### `stories`

The overall work and its stable slug. Stories should be archived rather than hard-deleted.

### `visitors`

Pseudonymous anonymous participants. The app issues a random opaque UUID in a signed `HttpOnly`, `SameSite=Lax` cookie. Never use IP as identity. Clearing cookies can create a new pseudonymous visitor, so this is only a lightweight duplicate-vote guard, not proof of unique humans. Avoid invasive fingerprinting.

### `story_units`

Stable anchors for the seed text, initially one sentence per unit. An anchor ID survives when its visible text is changed in a particular timeline. Seed-unit content is immutable. Do not use character positions in the whole document as permanent identity.

### `timelines`

An immutable branch node. Exactly one root should be created for each story by the seed/create-story transaction; the partial unique index in `schema.sql` enforces at most one root. A timeline's parent must belong to the same story. The application must ensure a root has no edit and every non-root has exactly one edit as part of the same transaction.

### `timeline_edits`

One patch introduced by a non-root timeline. Phase 2 supports whole-unit replacement only. Later phases add word/phrase spans and insertion/deletion. Store the selected text and a hash of the parent-rendered text so stale edits can be rejected instead of corrupting a different selection.

For browser selections, offsets are **zero-based UTF-16 code-unit offsets** to align with JavaScript/DOM selection APIs. The application must validate boundaries and must never split a Unicode surrogate pair. Also compare `selected_text` and the parent text hash before accepting a span edit. Test Swedish characters, emoji, combining marks, punctuation, and repeated words. Normalize Unicode consistently at write time only if documented; never normalize stored historical text silently.

For a patch on a unit, offsets are null. For a span patch, offsets refer to the unit exactly as rendered on the patch's parent timeline. Patch offsets are not interpreted against the root text if the parent has already changed that unit.

### `vote_targets`

A voteable target bound to one particular timeline rendering. Targets can represent a branch, a sentence/unit, a phrase, or a word. Keys are generated and validated on the server, not accepted verbatim from the browser. A target should be stable for its intended timeline rendering and must not accidentally refer to a different phrase after edits.

### `votes`

The current vote state: one row per `(visitor_id, vote_target_id)`, with value `+1` or `-1`. A visitor may change or clear it. Since a vote can be updated/deleted, this table is **not an append-only event ledger**. It is the authoritative current state from which scores are calculated. If a full audit of vote changes becomes necessary, add a separate append-only `vote_events` table later.

### `vote_attributions`

A derived projection that maps a direct vote to related contained/containing text targets. It is not a new vote, must not recursively propagate itself, and must be rebuildable from direct vote state plus the documented attribution rules. Validate that related targets refer to the same relevant story/timeline rendering.

### `timeline_render_snapshots` (optional optimization)

A cached, serialized rendering of an immutable timeline, keyed by timeline ID and renderer version. It is derived data, not source-of-truth content. Generate snapshots for deep or frequently visited timelines according to measured thresholds. To render a descendant, start from the nearest usable ancestor snapshot and apply only descendant patches. If renderer semantics change, bump the renderer version and rebuild snapshots. Snapshot payloads may be omitted from backups because they are rebuildable; document that choice.

### `vote_score_projection` (optional optimization)

A rebuildable aggregate of upvotes/downvotes/net scores per vote target. Start with the `direct_vote_target_scores` view in `schema.sql`. Only activate the projection after measuring a real bottleneck. If used, keep it transactionally correct or explicitly document its temporary eventual consistency, provide a full rebuild command, and compare it against the direct-vote source in tests.

### `moderation_actions` and `content_reports`

Later-phase tables for flagging content and recording auditable moderation. Moderation changes public visibility, not historical text or scores. Low popularity alone is never a moderation reason.

## 4. Rendering a timeline

1. Validate story and timeline IDs and confirm ownership.
2. Find the root-to-target ancestry path, using a recursive CTE or indexed parent traversal.
3. If an applicable snapshot exists, begin with the nearest ancestor snapshot; otherwise begin from immutable seed units.
4. Apply each remaining edit in ancestor-to-descendant order. Every patch is interpreted against its own parent rendering.
5. Return plain-text rendered content plus provenance metadata (which edit introduced a visible variant and which timeline URL to use for alternatives).
6. Escape output. Never render user-submitted HTML.

The first implementation may replay the whole path; tests should make rendering deterministic and correct. Later add snapshots/checkpoints for deep or hot paths. Do not make Redis a requirement for correctness.

## 5. Preferred timeline algorithm

Starting at the root, select the best-scoring child at each fork, then repeat from that child until there are no children. Rank each child using the score for the branch/change introduced by that child:

1. net score (`upvotes - downvotes`) descending;
2. upvotes descending;
3. creation time ascending;
4. UUID ascending as the deterministic final tie-breaker.

Do not sum every descendant vote onto every ancestor branch: long timelines would gain unfair advantage. In the MVP, use direct branch votes for branch ranking. If product behavior later changes, make it an explicit versioned decision.

Use the direct-score view first. A materialized/rebuildable score projection can be introduced if measurements show aggregation is expensive. If the projection is eventually consistent, the UI can reflect a slightly delayed preferred path; document and test that behavior.

## 6. Direct votes versus derived support

- A direct vote is one current `votes` row for a target.
- Derived support is a projection of that vote onto explicitly related words/phrases/sentences in the same selected rendering.
- Branch ranking is a distinct score policy.

In the attribution phase:
- A sentence vote may support its currently selected word/phrase targets.
- A word/phrase vote may support its containing phrase/sentence targets.
- Never attribute support to unrelated sentences or to alternatives not visible on that timeline.
- Never feed attribution rows back into attribution recursively.
- Changing or clearing a direct vote must update or remove its attributions idempotently.
- Tests should prove that a single direct vote remains one vote row even when it creates several derived support rows.

## 7. Indexing and hot paths

At minimum, index:
- `timelines(parent_timeline_id)` for child lookup;
- `timelines(story_id, created_at)` for history;
- `timeline_edits(target_unit_id)`;
- `vote_targets(story_id, timeline_id)` and unique `(timeline_id, target_key)`;
- `votes(vote_target_id)` plus unique `(visitor_id, vote_target_id)`;
- `vote_attributions(supported_target_id)`.

Use `EXPLAIN (ANALYZE, BUFFERS)` on representative queries before adding more indexes. Every additional index increases write cost and storage.

## 8. Branch example

```text
T0 — seed
├── T1 — replace “twelve dwarves” with “thirteen forgotten gods”
│   └── T3 — add “who feared the irrational number”
└── T2 — replace “twelve dwarves” with “twelve suspicious dwarves”
```

If T1 wins at T0, the preferred path may continue through T3 if T3 wins at T1. T2 is never deleted and has a stable URL.

## 9. API/domain example

```json
{
  "storyId": "story-uuid",
  "parentTimelineId": "parent-timeline-uuid",
  "edit": {
    "targetUnitId": "sentence-unit-uuid",
    "scopeType": "unit",
    "operation": "replace",
    "selectedText": "In the beginning, in the yard of angels, there were twelve dwarves and one irrational number.",
    "replacementText": "In the beginning, in the yard of angels, there were thirteen forgotten gods and one irrational number."
  }
}
```

The client never supplies a trusted score, visitor ID, or arbitrary database ID to authorize a write. Derive the visitor from the signed cookie, validate ownership and text server-side, and generate IDs/target keys server-side.

## 10. Invariants and transaction boundaries

- One root timeline per story; root has no edit.
- Every non-root timeline has exactly one edit and a valid parent in the same story.
- Timeline parentage is immutable and acyclic; do not expose parent mutation.
- Timeline creation and its edit are one transaction.
- An edit's target belongs to the same story.
- Span edits match the parent text/hash and have valid boundaries.
- A visitor has at most one current vote per target, enforced by a unique constraint.
- Vote changes and related attribution updates are transactional or have an idempotent rebuild strategy.
- Scores are never accepted from a client.
- Cache/snapshot and score-projection data can be rebuilt from authoritative rows.
- Old branches are not hard-deleted as a side effect of ranking or moderation.
