-- Phase 5: derived support projection.
-- vote_targets already supports 'sentence', 'phrase', and 'word' kinds (created
-- on demand against a specific rendering). This adds the projection that maps a
-- direct vote to related contained/containing targets. It is NOT a vote ledger.

CREATE TABLE vote_attributions (
  vote_id uuid NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  supported_target_id uuid NOT NULL REFERENCES vote_targets(id) ON DELETE RESTRICT,
  attribution_kind text NOT NULL CHECK (attribution_kind IN ('direct', 'contained', 'ancestor')),
  weight smallint NOT NULL DEFAULT 1 CHECK (weight >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vote_id, supported_target_id, attribution_kind)
);
CREATE INDEX vote_attributions_target_idx ON vote_attributions(supported_target_id);
