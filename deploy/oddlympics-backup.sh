#!/usr/bin/env bash
# oddlympics SQLite backup -> Backblaze B2.
# Run by oddlympics-backup.service; do not invoke directly without the
# matching environment file (/etc/oddlympics-backup.env).
set -euo pipefail

DB_PATH="${DATABASE_PATH:-/var/lib/oddlympics/oddlympics.db}"
CACHE_DIR=/var/cache/oddlympics-backup
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
SNAPSHOT="${CACHE_DIR}/oddlympics-${TS}.db"
REMOTE="${RCLONE_REMOTE:-b2}:${B2_BUCKET}/daily/oddlympics-${TS}.db"

: "${B2_ACCOUNT_ID:?B2_ACCOUNT_ID required (see /etc/oddlympics-backup.env)}"
: "${B2_APPLICATION_KEY:?B2_APPLICATION_KEY required}"
: "${B2_BUCKET:?B2_BUCKET required}"

mkdir -p "$CACHE_DIR"

# Use SQLite's online backup API (handles WAL, atomic, no lock contention).
sqlite3 "$DB_PATH" ".backup '${SNAPSHOT}'"

# Quick integrity check before uploading
if ! sqlite3 "$SNAPSHOT" "PRAGMA integrity_check" | grep -qx "ok"; then
  echo "[oddlympics-backup] integrity check FAILED for $SNAPSHOT" >&2
  rm -f "$SNAPSHOT"
  exit 1
fi

# rclone reads B2 credentials from RCLONE_CONFIG_<remote>_<key> env vars.
# We set them via the EnvironmentFile so no rclone.conf on disk is required.
export RCLONE_CONFIG_B2_TYPE=b2
export RCLONE_CONFIG_B2_ACCOUNT="$B2_ACCOUNT_ID"
export RCLONE_CONFIG_B2_KEY="$B2_APPLICATION_KEY"

rclone copyto "$SNAPSHOT" "$REMOTE" --quiet

# Local cache cleanup: keep the last 7 local snapshots so the operator can
# restore quickly without round-tripping to B2.
ls -1t "$CACHE_DIR"/oddlympics-*.db 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "[oddlympics-backup] uploaded $SNAPSHOT -> $REMOTE"
