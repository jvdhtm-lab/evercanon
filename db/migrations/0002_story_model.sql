-- Phase 1: stories, stable story units, and the immutable timeline tree roots.

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  seeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, story_id),
  CONSTRAINT timeline_parent_same_story_fk
    FOREIGN KEY (parent_timeline_id, story_id)
    REFERENCES timelines(id, story_id)
    ON DELETE RESTRICT
);

-- Exactly one root timeline per story, while allowing any number of children.
CREATE UNIQUE INDEX one_root_timeline_per_story
  ON timelines(story_id)
  WHERE parent_timeline_id IS NULL;

CREATE INDEX timelines_parent_idx ON timelines(parent_timeline_id);
CREATE INDEX timelines_story_created_idx ON timelines(story_id, created_at);
