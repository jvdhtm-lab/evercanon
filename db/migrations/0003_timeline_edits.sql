-- Phase 2: one immutable patch per non-root timeline.
-- Phase 2 writes only scope_type='unit', operation='replace'. Span edits and
-- insert/delete are allowed by the constraints now but are written later.

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
  request_key text,
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

-- Idempotency: a client-supplied request key must map to at most one edit per
-- story, so network retries cannot create duplicate sibling branches.
CREATE UNIQUE INDEX timeline_edits_request_key_key
  ON timeline_edits(story_id, request_key)
  WHERE request_key IS NOT NULL;
