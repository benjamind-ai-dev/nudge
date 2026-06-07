#!/usr/bin/env bash
#
# reset-test-data.sh — wipe ALL data for the Nudge test environment.
#
# Wipes Postgres (data only — schema + migrations preserved) and flushes Redis
# (all BullMQ jobs, repeatable schedulers, rate-limit keys). Stripe and Clerk
# are external systems and cannot be wiped from here — manual steps are printed
# at the end.
#
# This is a hard, irreversible data wipe. There is no separate production env
# for this MVP, so treat the printed target host as the real thing.
#
# Usage:
#   DATABASE_URL=... REDIS_URL=... ./scripts/reset-test-data.sh --yes
#   railway run ./scripts/reset-test-data.sh --yes      # injects Railway env
#
# Requires: psql, redis-cli on PATH.

set -euo pipefail

CONFIRM="${1:-}"

: "${DATABASE_URL:?DATABASE_URL not set (export it or use 'railway run')}"
: "${REDIS_URL:?REDIS_URL not set (export it or use 'railway run')}"

# Host shown for the confirmation prompt (best-effort parse, no creds leaked):
# strip scheme, strip optional user:pass@, then strip from the first :/ onward.
strip_host() { printf '%s' "$1" | sed -E 's#^[a-zA-Z]+://##; s#^[^@]*@##; s#[:/].*$##'; }
DB_HOST="$(strip_host "$DATABASE_URL")"
REDIS_HOST="$(strip_host "$REDIS_URL")"

if [[ "$CONFIRM" != "--yes" ]]; then
  echo "About to WIPE ALL DATA in:"
  echo "  Postgres : $DB_HOST   (all tables truncated; schema kept)"
  echo "  Redis    : $REDIS_HOST  (FLUSHALL)"
  echo
  echo "This is irreversible. Re-run with --yes to proceed."
  exit 1
fi

echo "==> Truncating all Postgres tables (schema + _prisma_migrations preserved)…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  ) LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
SQL

echo "==> Flushing Redis…"
redis-cli -u "$REDIS_URL" FLUSHALL

echo
echo "==> Postgres wiped, Redis flushed."
echo
echo "Manual steps (external — cannot be scripted here):"
echo "  1. Stripe (TEST mode): Customers → delete all. This cancels their subscriptions."
echo "     Do NOT use 'Delete all test data' — it also deletes Products/Prices and would"
echo "     break your STRIPE_PRICE_* env IDs."
echo "  2. Clerk (dev instance): Users → delete all. Organizations → delete all."
echo "  3. Restart API + worker. The worker re-registers repeatable jobs on boot."
echo
echo "Then sign up fresh to walk the full onboarding flow."
