-- Evercanon baseline migration.
-- pgcrypto provides gen_random_uuid() for primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
