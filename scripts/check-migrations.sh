#!/usr/bin/env bash

set -euo pipefail

migrations=(supabase/migrations/*.sql)
if [[ ! -e "${migrations[0]}" ]]; then
  echo "Guardian: no database migration found."
  exit 1
fi

for migration in "${migrations[@]}"; do
  if grep -Eq 'create table public\.' "${migration}" &&
    ! grep -Eq 'alter table .* enable row level security' "${migration}"; then
    echo "Guardian: ${migration} does not enable RLS."
    exit 1
  fi
done

required_patterns=(
  'drop policy "owners manage versions"'
  'create policy "owners read versions"'
  'create or replace function public.persist_generated_store'
  'create or replace function public.create_store_draft'
  'create or replace function public.create_rollback_draft'
  'revoke all on function public.consume_rate_limit'
  'stores_one_per_owner'
  'ai_jobs_one_active_type_per_user'
  'create or replace function public.prepare_event_identity'
  'stale_draft_version'
  'stale_parent_version'
  'stale_current_version'
)

if command -v rg >/dev/null 2>&1; then
  search_command=(rg -q -F)
else
  search_command=(grep -qF --)
fi

for pattern in "${required_patterns[@]}"; do
  if ! "${search_command[@]}" "${pattern}" "${migrations[@]}"; then
    echo "Guardian: migration hardening is missing: ${pattern}"
    exit 1
  fi
done

echo "Guardian: migration structure passed."
