#!/usr/bin/env bash
set -euo pipefail

# Local backup helper. It writes a compressed custom-format pg_dump file.
# Configure a separate off-site upload/copy and retention policy before public launch.
# Usage: DATABASE_URL='postgresql://...' ./scripts/backup-postgres.sh

: "${DATABASE_URL:?Set DATABASE_URL to the database to back up}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/evercanon-$STAMP.dump"

pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "$DEST"
sha256sum "$DEST" > "$DEST.sha256"
echo "Created backup: $DEST"
echo "IMPORTANT: copy this file and checksum off this server and test restoring it."
