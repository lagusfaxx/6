#!/bin/sh
set -e

# Convert legacy jpg/png uploads to webp (safe to run multiple times, non-fatal)
if [ -f /app/apps/api/scripts/convert-uploads-webp.js ]; then
  echo "[entrypoint] Running image conversion..."
  node /app/apps/api/scripts/convert-uploads-webp.js || echo "[entrypoint] Image conversion failed (non-fatal) — continuing"
fi

# Backfill Uzeed watermark on existing images (idempotent, non-fatal)
if [ -f /app/apps/api/scripts/backfill-watermarks.js ]; then
  echo "[entrypoint] Running watermark backfill..."
  node /app/apps/api/scripts/backfill-watermarks.js || echo "[entrypoint] Watermark backfill failed (non-fatal) — continuing"
fi

exec "$@"
