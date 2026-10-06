#!/usr/bin/env bash
set -euo pipefail

command_name="${1:-start}"
project_root="$(cd "$(dirname "$0")/.." && pwd -P)"
private_dir="${FIELDDESK_PRIVATE_DIR:-${HOME}/Library/Application Support/FieldDesk}"
pg_bin="${FIELDDESK_PG_BIN:-/usr/local/opt/postgresql@17/bin}"

if [[ ! -x "${pg_bin}/pg_ctl" || ! -x "${pg_bin}/initdb" ]]; then
  printf 'PostgreSQL 17 binaries not found at %s\n' "$pg_bin" >&2
  exit 1
fi
mkdir -p -m 700 "$private_dir"
private_dir="$(cd "$private_dir" && pwd -P)"
case "$private_dir/" in
  "$project_root/"*) printf 'Private database directory must be outside the repository.\n' >&2; exit 1 ;;
esac
chmod 700 "$private_dir"

case "$command_name" in
  start)
    umask 077
    [[ -f "$private_dir/dbpw" ]] || openssl rand -hex 24 > "$private_dir/dbpw"
    [[ -f "$private_dir/auth-secret" ]] || openssl rand -hex 32 > "$private_dir/auth-secret"
    if [[ ! -f "$private_dir/pgdata/PG_VERSION" ]]; then
      "$pg_bin/initdb" -D "$private_dir/pgdata" -U fielddesk --pwfile="$private_dir/dbpw" --auth-host=scram-sha-256 --auth-local=trust
    fi
    if ! "$pg_bin/pg_ctl" -D "$private_dir/pgdata" status >/dev/null 2>&1; then
      "$pg_bin/pg_ctl" -D "$private_dir/pgdata" -l "$private_dir/postgres.log" -o "-h 127.0.0.1 -p 5434 -k '$private_dir'" start
    fi
    if [[ "$("$pg_bin/psql" -h "$private_dir" -p 5434 -U fielddesk -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='fielddesk'")" != "1" ]]; then
      "$pg_bin/createdb" -h "$private_dir" -p 5434 -U fielddesk fielddesk
    fi
    printf 'export DATABASE_URL="postgresql://fielddesk:%s@127.0.0.1:5434/fielddesk?schema=public"\n' "$(cat "$private_dir/dbpw")" > "$private_dir/local.env"
    printf 'export BETTER_AUTH_SECRET="%s"\n' "$(cat "$private_dir/auth-secret")" >> "$private_dir/local.env"
    printf 'export BETTER_AUTH_URL="http://127.0.0.1:3000"\n' >> "$private_dir/local.env"
    chmod 600 "$private_dir/dbpw" "$private_dir/auth-secret" "$private_dir/local.env"
    printf 'Local PostgreSQL is running. Load private env: source "%s/local.env"\n' "$private_dir"
    ;;
  stop) "$pg_bin/pg_ctl" -D "$private_dir/pgdata" -m fast stop ;;
  status) "$pg_bin/pg_ctl" -D "$private_dir/pgdata" status ;;
  *) printf 'Usage: %s start|stop|status\n' "$0" >&2; exit 2 ;;
esac
