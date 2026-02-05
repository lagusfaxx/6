#!/usr/bin/env sh
set -e

# NOTE: Prisma migration is safe to run on startup; it does NOT generate client.
# Client must already exist from build stage.
if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    postgresql://*|postgres://*)
      echo "[entrypoint] prisma migrate deploy"
      ./prisma/node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma
      ;;
    *)
      echo "[entrypoint] DATABASE_URL is set but missing postgres protocol; skipping migrate."
      ;;
  esac
fi

exec "$@"
