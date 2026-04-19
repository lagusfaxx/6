#!/bin/sh
set -e

# Convert legacy jpg/png uploads to webp (safe to run multiple times, non-fatal)
if [ -f /app/apps/api/scripts/convert-uploads-webp.js ]; then
  echo "[entrypoint] Running image conversion..."
  node /app/apps/api/scripts/convert-uploads-webp.js || echo "[entrypoint] Image conversion failed (non-fatal) — continuing"
fi

# Migrate existing umate PREMIUM media to the private storage bucket
# (idempotent — skips already-migrated rows; non-fatal — API starts either way).
if [ -f /app/apps/api/scripts/migrate-umate-premium-to-private.js ]; then
  echo "[entrypoint] Migrating umate premium media to private storage..."
  node /app/apps/api/scripts/migrate-umate-premium-to-private.js || echo "[entrypoint] Premium migration failed (non-fatal) — continuing"
fi

# Seed a FREE carousel post from the Uzeed gallery for creators that have no posts yet
# (idempotent — skips creators with any existing post; non-fatal).
if [ -f /app/apps/api/scripts/import-gallery-to-umate-posts.js ]; then
  echo "[entrypoint] Importing Uzeed gallery into UMate posts..."
  node /app/apps/api/scripts/import-gallery-to-umate-posts.js || echo "[entrypoint] Gallery import failed (non-fatal) — continuing"
fi

exec "$@"
