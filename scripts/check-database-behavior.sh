#!/usr/bin/env bash

set -euo pipefail

if ! command -v pg_config >/dev/null; then
  echo "Guardian: PostgreSQL is required for database behavior checks."
  exit 1
fi

postgres_bin="$(pg_config --bindir)"
for command_name in initdb pg_ctl psql; do
  if [[ ! -x "${postgres_bin}/${command_name}" ]]; then
    echo "Guardian: missing PostgreSQL command: ${command_name}"
    exit 1
  fi
done

database_root="$(mktemp -d /tmp/amboras-guardian.XXXXXX)"
database_data="${database_root}/data"
database_port="$((54000 + ($$ % 1000)))"
database_log="${database_root}/postgres.log"

cleanup() {
  if [[ -f "${database_data}/postmaster.pid" ]]; then
    "${postgres_bin}/pg_ctl" -D "${database_data}" -m fast stop >/dev/null
  fi
  rm -rf "${database_root}"
}
trap cleanup EXIT

"${postgres_bin}/initdb" -A trust -U postgres -D "${database_data}" \
  >"${database_log}"
"${postgres_bin}/pg_ctl" -D "${database_data}" \
  -o "-F -p ${database_port} -k ${database_root}" -w start >>"${database_log}"

psql_args=(
  -h "${database_root}"
  -p "${database_port}"
  -U postgres
  -d postgres
  -v ON_ERROR_STOP=1
  -q
)

"${postgres_bin}/psql" "${psql_args[@]}" \
  -f tests/database/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  "${postgres_bin}/psql" "${psql_args[@]}" -f "${migration}"
done
"${postgres_bin}/psql" "${psql_args[@]}" \
  -f tests/database/integrity.sql

echo "Guardian: database migrations and behavior passed."
