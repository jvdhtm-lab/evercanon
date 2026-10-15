-- Phase 3: pseudonymous visitors, branch vote targets, and the direct vote ledger.

CREATE TABLE visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- Attribute the timeline (and later its edit) to the pseudonymous creator.
ALTER TABLE timelines
  ADD COLUMN created_by_visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL;

-- A voteable target bound to one timeline rendering.
-- Phase 3 creates only target_kind='branch'. Sentence/phrase/word come later.
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

-- Current vote state: one row per (visitor_id, vote_target_id). Not an
-- append-only ledger; a visitor may change or clear their vote.
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

-- Authoritative direct score from the vote rows.
CREATE VIEW direct_vote_target_scores AS
SELECT
  vt.id AS vote_target_id,
  COUNT(v.id) FILTER (WHERE v.value = 1) AS upvotes,
  COUNT(v.id) FILTER (WHERE v.value = -1) AS downvotes,
  COALESCE(SUM(v.value), 0) AS net_score
FROM vote_targets vt
LEFT JOIN votes v ON v.vote_target_id = vt.id
GROUP BY vt.id;

-- Backfill branch targets for any non-root timelines created before this phase.
INSERT INTO vote_targets (story_id, timeline_id, target_kind, target_text, target_key)
SELECT t.story_id, t.id, 'branch', COALESCE(e.replacement_text, ''), 'branch'
FROM timelines t
LEFT JOIN timeline_edits e ON e.timeline_id = t.id
WHERE t.parent_timeline_id IS NOT NULL
ON CONFLICT (timeline_id, target_key) DO NOTHING;
