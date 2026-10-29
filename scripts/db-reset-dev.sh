#!/usr/bin/env bash
# DEV ONLY: drop and recreate the local database, apply shim + migrations + seed.
set -euo pipefail
PSQL="psql -h 127.0.0.1 -p ${PGPORT:-54322} -U postgres -q"
DB=${1:-shopnear}
$PSQL -c "drop database if exists $DB with (force)" -c "create database $DB"
DATABASE_URL="postgres://postgres@127.0.0.1:${PGPORT:-54322}/$DB" npx tsx scripts/migrate.ts --dev
DATABASE_URL="postgres://postgres@127.0.0.1:${PGPORT:-54322}/$DB" npx tsx scripts/seed.ts
