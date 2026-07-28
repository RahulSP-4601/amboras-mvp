alter table public.store_versions
  add column mutation_key uuid,
  add column mutation_base_version_id uuid
    references public.store_versions(id);

create unique index store_versions_mutation_key_unique
  on public.store_versions(store_id, mutation_key)
  where mutation_key is not null;

drop function public.persist_generated_store(
  uuid, uuid, text, text, uuid, text, text, numeric, text, jsonb, text
);

create function public.persist_generated_store(
  target_user_id uuid,
  target_job_id uuid,
  expected_attempt_count integer,
  expected_started_at timestamptz,
  target_store_name text,
  target_slug text,
  target_product_id uuid,
  target_product_name text,
  target_product_description text,
  target_product_price numeric,
  target_product_image_path text,
  store_config jsonb,
  generation_mode text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  job_status public.ai_job_status;
  new_store_id uuid := gen_random_uuid();
  new_version_id uuid := gen_random_uuid();
  result_payload jsonb;
begin
  if generation_mode not in ('openai', 'local_preview') then
    raise exception 'invalid_generation_mode';
  end if;
  if store_config->>'productId' <> target_product_id::text then
    raise exception 'product_config_mismatch';
  end if;
  select status into job_status
  from public.ai_jobs
  where id = target_job_id
    and user_id = target_user_id
    and attempt_count = expected_attempt_count
    and started_at = expected_started_at
  for update;
  if job_status is distinct from 'running' then
    raise exception 'generation_attempt_not_running';
  end if;

  insert into public.profiles(id)
  values (target_user_id)
  on conflict (id) do nothing;
  insert into public.stores(id, owner_id, name, slug)
  values (new_store_id, target_user_id, target_store_name, target_slug);
  insert into public.products(
    id, store_id, name, description, price, image_path
  ) values (
    target_product_id, new_store_id, target_product_name,
    target_product_description, target_product_price, target_product_image_path
  );
  insert into public.store_versions(
    id, store_id, version_number, config, status, source, created_by
  ) values (
    new_version_id, new_store_id, 1, store_config,
    'draft', 'ai_generation', target_user_id
  );
  update public.stores
  set current_draft_version_id = new_version_id
  where id = new_store_id;

  result_payload := jsonb_build_object(
    'config', store_config,
    'mode', generation_mode,
    'persisted', jsonb_build_object(
      'storeId', new_store_id,
      'versionId', new_version_id,
      'slug', target_slug
    )
  );
  update public.ai_jobs set
    store_id = new_store_id,
    status = 'succeeded',
    current_stage = 'saving_draft_version',
    error_code = null,
    result = result_payload,
    completed_at = now()
  where id = target_job_id
    and attempt_count = expected_attempt_count
    and started_at = expected_started_at;
  return result_payload;
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
  if current_published = target_version_id and current_draft is null then
    if not exists (
      select 1 from public.store_versions
      where id = target_version_id
        and store_id = target_store_id
        and status = 'published'
    ) then raise exception 'invalid_published_version'; end if;
    return;
  end if;
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

drop function public.create_store_draft(uuid, uuid, uuid, jsonb, text);

create function public.create_store_draft(
  target_user_id uuid,
  target_store_id uuid,
  target_parent_version_id uuid,
  target_mutation_key uuid,
  store_config jsonb,
  version_source text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  expected_parent uuid;
  existing_version public.store_versions%rowtype;
  next_number integer;
  new_version_id uuid := gen_random_uuid();
  created_time timestamptz := now();
begin
  select coalesce(current_draft_version_id, current_published_version_id)
  into expected_parent from public.stores
  where id = target_store_id and owner_id = target_user_id for update;
  if not found then raise exception 'store_not_owned'; end if;
  select * into existing_version from public.store_versions
  where store_id = target_store_id and mutation_key = target_mutation_key;
  if found then
    if existing_version.parent_version_id is distinct from target_parent_version_id
      or existing_version.mutation_base_version_id
        is distinct from target_parent_version_id
      or existing_version.source is distinct from version_source
      or existing_version.config is distinct from store_config
    then raise exception 'mutation_key_conflict'; end if;
    return public.version_mutation_payload(existing_version);
  end if;
  if version_source not in ('manual_edit', 'ai_edit') then
    raise exception 'invalid_version_source';
  end if;
  if expected_parent is distinct from target_parent_version_id then
    raise exception 'stale_parent_version';
  end if;
  if not exists (
    select 1 from public.products
    where store_id = target_store_id
      and id::text = store_config->>'productId'
  ) then raise exception 'product_config_mismatch'; end if;
  update public.store_versions set status = 'archived'
  where id = expected_parent
    and store_id = target_store_id
    and status = 'draft';
  select coalesce(max(version_number), 0) + 1 into next_number
  from public.store_versions where store_id = target_store_id;
  insert into public.store_versions(
    id, store_id, version_number, config, status, source,
    parent_version_id, created_by, created_at, mutation_key,
    mutation_base_version_id
  ) values (
    new_version_id, target_store_id, next_number, store_config, 'draft',
    version_source, target_parent_version_id, target_user_id, created_time,
    target_mutation_key, target_parent_version_id
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

drop function public.create_rollback_draft(uuid, uuid, uuid, uuid);

create function public.create_rollback_draft(
  target_user_id uuid,
  target_store_id uuid,
  expected_current_version_id uuid,
  target_version_id uuid,
  target_mutation_key uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  expected_current uuid;
  existing_version public.store_versions%rowtype;
  target_config jsonb;
  next_number integer;
  new_version_id uuid := gen_random_uuid();
  created_time timestamptz := now();
begin
  select coalesce(current_draft_version_id, current_published_version_id)
  into expected_current from public.stores
  where id = target_store_id and owner_id = target_user_id for update;
  if not found then raise exception 'store_not_owned'; end if;
  select * into existing_version from public.store_versions
  where store_id = target_store_id and mutation_key = target_mutation_key;
  if found then
    if existing_version.source <> 'rollback'
      or existing_version.parent_version_id is distinct from target_version_id
      or existing_version.mutation_base_version_id
        is distinct from expected_current_version_id
    then raise exception 'mutation_key_conflict'; end if;
    return public.version_mutation_payload(existing_version);
  end if;
  if expected_current is distinct from expected_current_version_id then
    raise exception 'stale_current_version';
  end if;
  select config into target_config from public.store_versions
  where id = target_version_id and store_id = target_store_id;
  if target_config is null then raise exception 'rollback_target_missing'; end if;
  update public.store_versions set status = 'archived'
  where id = expected_current
    and store_id = target_store_id
    and status = 'draft';
  select coalesce(max(version_number), 0) + 1 into next_number
  from public.store_versions where store_id = target_store_id;
  insert into public.store_versions(
    id, store_id, version_number, config, status, source,
    parent_version_id, created_by, created_at, mutation_key,
    mutation_base_version_id
  ) values (
    new_version_id, target_store_id, next_number, target_config, 'draft',
    'rollback', target_version_id, target_user_id, created_time,
    target_mutation_key, expected_current_version_id
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

create function public.version_mutation_payload(
  version public.store_versions
) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', version.id,
    'versionNumber', version.version_number,
    'config', version.config,
    'status', version.status,
    'source', version.source,
    'parentVersionId', version.parent_version_id,
    'createdAt', version.created_at
  )
$$;

revoke all on function public.persist_generated_store(
  uuid, uuid, integer, timestamptz, text, text, uuid, text, text,
  numeric, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.persist_generated_store(
  uuid, uuid, integer, timestamptz, text, text, uuid, text, text,
  numeric, text, jsonb, text
) to service_role;

revoke all on function public.create_store_draft(
  uuid, uuid, uuid, uuid, jsonb, text
) from public, anon, authenticated;
grant execute on function public.create_store_draft(
  uuid, uuid, uuid, uuid, jsonb, text
) to service_role;

revoke all on function public.create_rollback_draft(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_rollback_draft(
  uuid, uuid, uuid, uuid, uuid
) to service_role;

revoke all on function public.version_mutation_payload(public.store_versions)
  from public, anon, authenticated;
grant execute on function public.version_mutation_payload(public.store_versions)
  to service_role;
