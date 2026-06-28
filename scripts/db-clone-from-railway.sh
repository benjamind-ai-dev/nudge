#!/usr/bin/env bash
set -euo pipefail

# Clone the Railway Postgres database into the local Docker Postgres.
#
# Source defaults to DATABASE_URL in apps/api/.env (Railway).
# Target defaults to the local docker-compose Postgres.
#
# pg_dump / pg_restore run INSIDE the nudge-postgres container so the client
# version always matches the local server and we never depend on a locally
# installed postgres client. Because the commands run inside that container,
# "localhost" in the target URL refers to the container's own Postgres.
#
# Usage:
#   ./scripts/db-clone-from-railway.sh
#   SOURCE_DATABASE_URL=postgres://... ./scripts/db-clone-from-railway.sh
#   TARGET_DATABASE_URL=postgres://... ./scripts/db-clone-from-railway.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${PG_CONTAINER:-nudge-postgres}"

# --- Resolve source (Railway) URL -------------------------------------------
SOURCE_URL="${SOURCE_DATABASE_URL:-}"
if [ -z "$SOURCE_URL" ]; then
  SOURCE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/apps/api/.env" | head -n1 | cut -d= -f2- | tr -d '"')"
fi
if [ -z "$SOURCE_URL" ]; then
  echo "ERROR: could not determine source DATABASE_URL (set SOURCE_DATABASE_URL)." >&2
  exit 1
fi

# --- Resolve target (local) URL ---------------------------------------------
TARGET_URL="${TARGET_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/nudge}"

echo "Source : ${SOURCE_URL%%@*}@<redacted-railway-host>"
echo "Target : $TARGET_URL"
echo

# --- Safety: confirm before clobbering the local DB -------------------------
if [ -z "${YES:-}" ]; then
  read -r -p "This DROPS and recreates all objects in the target DB. Continue? [y/N] " reply
  case "$reply" in
    [yY] | [yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# --- Ensure the container is running ----------------------------------------
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '$CONTAINER' is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

echo "Dumping from Railway and restoring into local..."
docker exec -i "$CONTAINER" pg_dump "$SOURCE_URL" -Fc --no-owner --no-acl \
  | docker exec -i "$CONTAINER" pg_restore --clean --if-exists --no-owner --no-acl -d "$TARGET_URL"

echo
echo "Done. Local database now mirrors Railway."
