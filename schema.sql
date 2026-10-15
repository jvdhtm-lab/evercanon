-- Evercanon PostgreSQL reference schema.
-- Use incrementally by phase; do not apply every future table during Phase 1.
-- PostgreSQL 15+ recommended. Source-of-truth records live here.
-- Popularity determines visibility, never existence.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  seeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE story_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 0),
  unit_type text NOT NULL CHECK (unit_type IN ('sentence', 'paragraph')),
  initial_text text NOT NULL CHECK (length(btrim(initial_text)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, story_id),
  UNIQUE (story_id, position)
);

CREATE TABLE timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE RESTRICT,
  parent_timeline_id uuid,
  created_by_visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, story_id),
  CONSTRAINT timeline_parent_same_story_fk
    FOREIGN KEY (parent_timeline_id, story_id)
    REFERENCES timelines(id, story_id)
    ON DELETE RESTRICT
);

-- Enforces at most one root. Story creation/seed transaction must create one root.
CREATE UNIQUE INDEX one_root_timeline_per_story
  ON timelines(story_id)
  WHERE parent_timeline_id IS NULL;
CREATE INDEX timelines_parent_idx ON timelines(parent_timeline_id);
CREATE INDEX timelines_story_created_idx ON timelines(story_id, created_at);

CREATE TABLE timeline_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE RESTRICT,
  timeline_id uuid NOT NULL UNIQUE,
  target_unit_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('unit', 'span')),
  operation text NOT NULL CHECK (operation IN ('replace', 'insert_before', 'insert_after', 'delete')),
  start_offset integer,
  end_offset integer,
  selected_text text NOT NULL DEFAULT '',
  replacement_text text NOT NULL DEFAULT '',
  parent_text_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (timeline_id, story_id)
    REFERENCES timelines(id, story_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_unit_id, story_id)
    REFERENCES story_units(id, story_id) ON DELETE RESTRICT,
  CHECK (
    (scope_type = 'unit' AND start_offset IS NULL AND end_offset IS NULL)
    OR
    (scope_type = 'span' AND start_offset IS NOT NULL AND end_offset IS NOT NULL
      AND start_offset >= 0 AND end_offset >= start_offset)
  ),
  CHECK (
    (operation = 'delete' AND replacement_text = '')
    OR (operation IN ('insert_before', 'insert_after') AND selected_text = '' AND length(btrim(replacement_text)) > 0)
    OR (operation = 'replace' AND length(btrim(selected_text)) > 0 AND length(btrim(replacement_text)) > 0)
  )
);
CREATE INDEX timeline_edits_target_idx ON timeline_edits(target_unit_id);

CREATE TABLE vote_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE RESTRICT,
  timeline_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('branch', 'sentence', 'phrase', 'word')),
  target_unit_id uuid,
  start_offset integer,
  end_offset integer,
  target_text text NOT NULL DEFAULT '',
  target_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (timeline_id, story_id)
    REFERENCES timelines(id, story_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_unit_id, story_id)
    REFERENCES story_units(id, story_id) ON DELETE RESTRICT,
  UNIQUE (timeline_id, target_key),
  CHECK (
    (target_kind = 'branch' AND target_unit_id IS NULL AND start_offset IS NULL AND end_offset IS NULL)
    OR
    (target_kind = 'sentence' AND target_unit_id IS NOT NULL AND start_offset IS NULL AND end_offset IS NULL)
    OR
    (target_kind IN ('phrase', 'word') AND target_unit_id IS NOT NULL
      AND start_offset IS NOT NULL AND end_offset IS NOT NULL
      AND start_offset >= 0 AND end_offset > start_offset)
  )
);
CREATE INDEX vote_targets_story_timeline_idx ON vote_targets(story_id, timeline_id);

-- This is the current vote state, not an append-only event ledger.
CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE RESTRICT,
  vote_target_id uuid NOT NULL REFERENCES vote_targets(id) ON DELETE RESTRICT,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, vote_target_id)
);
CREATE INDEX votes_target_idx ON votes(vote_target_id);

-- Derived support; never treat these rows as additional votes. Rebuildable.
CREATE TABLE vote_attributions (
  vote_id uuid NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  supported_target_id uuid NOT NULL REFERENCES vote_targets(id) ON DELETE RESTRICT,
  attribution_kind text NOT NULL CHECK (attribution_kind IN ('direct', 'contained', 'ancestor')),
  weight smallint NOT NULL DEFAULT 1 CHECK (weight >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vote_id, supported_target_id, attribution_kind)
);
CREATE INDEX vote_attributions_target_idx ON vote_attributions(supported_target_id);

-- Optional: immutable-render cache. Never the source of truth. Key on renderer version
-- so rendering semantics can evolve without corrupting historical timelines.
CREATE TABLE timeline_render_snapshots (
  timeline_id uuid NOT NULL REFERENCES timelines(id) ON DELETE RESTRICT,
  renderer_version integer NOT NULL CHECK (renderer_version > 0),
  snapshot jsonb NOT NULL,
  text_checksum char(64) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (timeline_id, renderer_version)
);

-- Optional: rebuildable aggregate. Start with the view below; use this projection
-- only when profiling proves that direct aggregation is too expensive.
CREATE TABLE vote_score_projection (
  vote_target_id uuid PRIMARY KEY REFERENCES vote_targets(id) ON DELETE RESTRICT,
  upvotes bigint NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downvotes bigint NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
  net_score bigint NOT NULL DEFAULT 0,
  calculation_version integer NOT NULL DEFAULT 1,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timelines(id) ON DELETE RESTRICT,
  reporter_visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_reports_status_created_idx ON content_reports(status, created_at);

CREATE TABLE moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES timelines(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('restrict_public_display', 'restore_public_display', 'mark_reviewed')),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  actor_type text NOT NULL CHECK (actor_type IN ('maintainer', 'automated')),
  actor_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_timeline_created_idx ON moderation_actions(timeline_id, created_at);

-- Authoritative direct score. Correctness baseline; can be slower at very high volume.
CREATE VIEW direct_vote_target_scores AS
SELECT
  vt.id AS vote_target_id,
  COUNT(v.id) FILTER (WHERE v.value = 1) AS upvotes,
  COUNT(v.id) FILTER (WHERE v.value = -1) AS downvotes,
  COALESCE(SUM(v.value), 0) AS net_score
FROM vote_targets vt
LEFT JOIN votes v ON v.vote_target_id = vt.id
GROUP BY vt.id;

-- Application/transaction invariants not all expressible with simple CHECK constraints:
-- * exactly one root and root has no edit; every child has exactly one edit;
-- * no parent update/cycles; parent/edit are immutable after insert;
-- * vote target/unit/story consistency and attribution same-rendering validation;
-- * span matches parent-rendered selected text and hash.
-- Enforce through domain services + transactions + integration tests. Consider SQL
-- constraint triggers only if writes outside the application need to be supported.
