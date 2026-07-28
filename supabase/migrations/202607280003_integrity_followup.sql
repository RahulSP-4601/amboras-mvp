alter table public.stores
  add constraint stores_one_per_owner unique (owner_id);

create unique index ai_jobs_one_active_type_per_user
  on public.ai_jobs(user_id, job_type)
  where status in ('queued', 'running');

alter table public.sessions
  add constraint sessions_identity_store_unique
  unique (id, visitor_id, store_id);

alter table public.events
  add constraint events_session_identity_fk
  foreign key (session_id, visitor_id, store_id)
  references public.sessions(id, visitor_id, store_id);

create table public.rate_limit_maintenance (
  singleton boolean primary key default true check (singleton),
  last_pruned_at timestamptz not null default now()
);

insert into public.rate_limit_maintenance(singleton) values (true);
alter table public.rate_limit_maintenance enable row level security;
create index rate_limits_time_bucket_idx
  on public.rate_limits(time_bucket);

create policy "owners delete product images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.consume_rate_limit(
  limit_key text,
  bucket timestamptz,
  request_limit integer
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  next_count integer;
  should_prune boolean;
begin
  if request_limit < 1 then raise exception 'invalid_request_limit'; end if;
  update public.rate_limit_maintenance
  set last_pruned_at = now()
  where singleton and last_pruned_at < now() - interval '1 hour'
  returning true into should_prune;
  if should_prune then
    delete from public.rate_limits
    where time_bucket < now() - interval '2 days';
  end if;
  insert into public.rate_limits(key, time_bucket, request_count)
  values (limit_key, bucket, 1)
  on conflict (key, time_bucket)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into next_count;
  return next_count <= request_limit;
end;
$$;

create or replace function public.prepare_event_identity(
  target_session_id uuid,
  target_visitor_id uuid,
  target_store_id uuid,
  target_synthetic boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.visitors(id, synthetic)
  values (target_visitor_id, target_synthetic)
  on conflict (id) do nothing;
  if not exists (
    select 1 from public.visitors
    where id = target_visitor_id and synthetic = target_synthetic
  ) then raise exception 'visitor_identity_mismatch'; end if;
  insert into public.sessions(
    id, visitor_id, store_id, last_seen_at, synthetic
  ) values (
    target_session_id, target_visitor_id, target_store_id, now(), target_synthetic
  )
  on conflict (id) do update
  set last_seen_at = excluded.last_seen_at
  where public.sessions.visitor_id = excluded.visitor_id
    and public.sessions.store_id = excluded.store_id
    and public.sessions.synthetic = excluded.synthetic;
  if not found then raise exception 'session_identity_mismatch'; end if;
end;
$$;

create or replace function public.publish_store_version(
  target_store_id uuid,
  target_version_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_published uuid;
  current_draft uuid;
begin
  select current_published_version_id, current_draft_version_id
  into current_published, current_draft
  from public.stores
  where id = target_store_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'store_not_owned'; end if;
  if current_draft is distinct from target_version_id then
    raise exception 'stale_draft_version';
  end if;
  if not exists (
    select 1 from public.store_versions
    where id = target_version_id
      and store_id = target_store_id
      and status = 'draft'
  ) then raise exception 'invalid_draft'; end if;
  if current_published is not null then
    update public.store_versions set status = 'archived'
    where id = current_published;
  end if;
  update public.store_versions set status = 'published'
  where id = target_version_id;
  update public.stores set
    current_published_version_id = target_version_id,
    current_draft_version_id = null,
    status = 'published',
    updated_at = now()
  where id = target_store_id;
end;
$$;

create or replace function public.create_store_draft(
  target_user_id uuid,
  target_store_id uuid,
  target_parent_version_id uuid,
  store_config jsonb,
  version_source text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  expected_parent uuid;
  next_number integer;
  new_version_id uuid := gen_random_uuid();
  created_time timestamptz := now();
begin
  if version_source not in ('manual_edit', 'ai_edit') then
    raise exception 'invalid_version_source';
  end if;
  select coalesce(current_draft_version_id, current_published_version_id)
  into expected_parent from public.stores
  where id = target_store_id and owner_id = target_user_id for update;
  if not found then raise exception 'store_not_owned'; end if;
  if expected_parent is distinct from target_parent_version_id then
    raise exception 'stale_parent_version';
  end if;
  if not exists (
    select 1 from public.products
    where store_id = target_store_id
      and id::text = store_config->>'productId'
  ) then raise exception 'product_config_mismatch'; end if;
  select coalesce(max(version_number), 0) + 1 into next_number
  from public.store_versions where store_id = target_store_id;
  insert into public.store_versions(
    id, store_id, version_number, config, status, source,
    parent_version_id, created_by, created_at
  ) values (
    new_version_id, target_store_id, next_number, store_config, 'draft',
    version_source, target_parent_version_id, target_user_id, created_time
  );
  update public.stores set
    current_draft_version_id = new_version_id, updated_at = created_time
  where id = target_store_id;
  return jsonb_build_object(
    'id', new_version_id, 'versionNumber', next_number,
    'config', store_config, 'status', 'draft', 'source', version_source,
    'parentVersionId', target_parent_version_id, 'createdAt', created_time
  );
end;
$$;

drop function public.create_rollback_draft(uuid, uuid, uuid);
create function public.create_rollback_draft(
  target_user_id uuid,
  target_store_id uuid,
  expected_current_version_id uuid,
  target_version_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  expected_current uuid;
  target_config jsonb;
  next_number integer;
  new_version_id uuid := gen_random_uuid();
  created_time timestamptz := now();
begin
  select coalesce(current_draft_version_id, current_published_version_id)
  into expected_current from public.stores
  where id = target_store_id and owner_id = target_user_id for update;
  if not found then raise exception 'store_not_owned'; end if;
  if expected_current is distinct from expected_current_version_id then
    raise exception 'stale_current_version';
  end if;
  select config into target_config from public.store_versions
  where id = target_version_id and store_id = target_store_id;
  if target_config is null then raise exception 'rollback_target_missing'; end if;
  select coalesce(max(version_number), 0) + 1 into next_number
  from public.store_versions where store_id = target_store_id;
  insert into public.store_versions(
    id, store_id, version_number, config, status, source,
    parent_version_id, created_by, created_at
  ) values (
    new_version_id, target_store_id, next_number, target_config, 'draft',
    'rollback', target_version_id, target_user_id, created_time
  );
  update public.stores set
    current_draft_version_id = new_version_id, updated_at = created_time
  where id = target_store_id;
  return jsonb_build_object(
    'id', new_version_id, 'versionNumber', next_number,
    'config', target_config, 'status', 'draft', 'source', 'rollback',
    'parentVersionId', target_version_id, 'createdAt', created_time
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, timestamptz, integer)
  to service_role;

revoke all on function public.prepare_event_identity(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.prepare_event_identity(uuid, uuid, uuid, boolean)
  to service_role;

revoke all on function public.publish_store_version(uuid, uuid)
  from public, anon;
grant execute on function public.publish_store_version(uuid, uuid)
  to authenticated;

revoke all on function public.create_store_draft(
  uuid, uuid, uuid, jsonb, text
) from public, anon, authenticated;
grant execute on function public.create_store_draft(
  uuid, uuid, uuid, jsonb, text
) to service_role;

revoke all on function public.create_rollback_draft(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_rollback_draft(
  uuid, uuid, uuid, uuid
) to service_role;
