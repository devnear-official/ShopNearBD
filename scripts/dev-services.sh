#!/usr/bin/env bash
# DEV ONLY (no-Docker environments): start local Postgres on :54322 and the
# auth/storage stand-in on :54321. With Docker, use `supabase start` instead.
set -uo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA=${PGDATA:-$HOME/.pg/data}
if ! pg_isready -h 127.0.0.1 -p 54322 -q; then
  if [ ! -d "$PGDATA" ]; then
    mkdir -p "$PGDATA" && $PGBIN/initdb -D "$PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
  fi
  $PGBIN/pg_ctl -D "$PGDATA" -o "-p 54322 -k /tmp" -l "$(dirname "$PGDATA")/log" start >/dev/null
fi
if ! curl -sf http://127.0.0.1:54321/auth/v1/health >/dev/null; then
  nohup npx tsx scripts/devstack/server.ts > .devstack.log 2>&1 &
fi
sleep 3
pg_isready -h 127.0.0.1 -p 54322 && curl -sf http://127.0.0.1:54321/auth/v1/health && echo
