do $$
declare
  user_a constant uuid := '10000000-0000-4000-8000-000000000001';
  user_b constant uuid := '10000000-0000-4000-8000-000000000002';
  user_c constant uuid := '10000000-0000-4000-8000-000000000003';
  store_a constant uuid := '20000000-0000-4000-8000-000000000001';
  store_b constant uuid := '20000000-0000-4000-8000-000000000002';
  product_a constant uuid := '30000000-0000-4000-8000-000000000001';
  generated_product constant uuid := '30000000-0000-4000-8000-000000000002';
  version_a constant uuid := '40000000-0000-4000-8000-000000000001';
  generation_job constant uuid := '80000000-0000-4000-8000-000000000001';
  visitor_a constant uuid := '50000000-0000-4000-8000-000000000001';
  session_a constant uuid := '60000000-0000-4000-8000-000000000001';
  draft_key constant uuid := '70000000-0000-4000-8000-000000000001';
  rollback_key constant uuid := '70000000-0000-4000-8000-000000000002';
  job_started constant timestamptz := '2026-07-28T12:00:00Z';
  draft_result jsonb;
  rollback_result jsonb;
  current_draft uuid;
begin
  insert into auth.users(id) values (user_a), (user_b), (user_c);
  insert into public.profiles(id) values (user_a), (user_b), (user_c);
  insert into public.stores(id, owner_id, name, slug)
  values
    (store_a, user_a, 'Store A', 'store-a'),
    (store_b, user_b, 'Store B', 'store-b');

  begin
    insert into public.stores(owner_id, name, slug)
    values (user_a, 'Duplicate', 'duplicate-store');
    raise exception 'one_store_constraint_missing';
  exception
    when unique_violation then null;
  end;

  insert into public.products(
    id, store_id, name, description, price
  ) values (
    product_a, store_a, 'Product A',
    'A sufficiently detailed product description for the database test.', 25
  );
  insert into public.store_versions(
    id, store_id, version_number, config, source, created_by
  ) values (
    version_a, store_a, 1,
    jsonb_build_object('productId', product_a), 'ai_generation', user_a
  );
  update public.stores set current_draft_version_id = version_a
  where id = store_a;

  draft_result := public.create_store_draft(
    user_a, store_a, version_a, draft_key,
    jsonb_build_object('productId', product_a), 'manual_edit'
  );
  current_draft := (draft_result->>'id')::uuid;
  if public.create_store_draft(
    user_a, store_a, version_a, draft_key,
    jsonb_build_object('productId', product_a), 'manual_edit'
  )->>'id' <> current_draft::text then
    raise exception 'draft_replay_created_a_duplicate';
  end if;
  if exists (
    select 1 from public.store_versions
    where id = version_a and status <> 'archived'
  ) then raise exception 'superseded_draft_was_not_archived'; end if;

  begin
    perform public.create_store_draft(
      user_a, store_a, version_a, gen_random_uuid(),
      jsonb_build_object('productId', product_a), 'manual_edit'
    );
    raise exception 'stale_parent_was_accepted';
  exception
    when others then
      if sqlerrm not like '%stale_parent_version%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  begin
    perform public.publish_store_version(store_a, version_a);
    raise exception 'stale_publish_was_accepted';
  exception
    when others then
      if sqlerrm not like '%stale_draft_version%' then raise; end if;
  end;
  perform public.publish_store_version(store_a, current_draft);
  perform public.publish_store_version(store_a, current_draft);
  begin
    perform public.create_rollback_draft(
      user_a, store_a, version_a, version_a, gen_random_uuid()
    );
    raise exception 'stale_rollback_was_accepted';
  exception
    when others then
      if sqlerrm not like '%stale_current_version%' then raise; end if;
  end;
  rollback_result := public.create_rollback_draft(
    user_a, store_a, current_draft, version_a, rollback_key
  );
  if exists (
    select 1 from public.store_versions
    where id = current_draft and status = 'draft'
  ) then raise exception 'rollback_left_superseded_draft_active'; end if;
  if public.create_rollback_draft(
    user_a, store_a, current_draft, version_a, rollback_key
  )->>'id' <> rollback_result->>'id' then
    raise exception 'rollback_replay_created_a_duplicate';
  end if;
  begin
    perform public.create_rollback_draft(
      user_a, store_a, version_a, version_a, rollback_key
    );
    raise exception 'rollback_key_payload_conflict_was_accepted';
  exception
    when others then
      if sqlerrm not like '%mutation_key_conflict%' then raise; end if;
  end;

  insert into public.ai_jobs(
    user_id, job_type, status, idempotency_key, attempt_count,
    prompt_version, schema_version, input_summary
  ) values (
    user_a, 'store_generation', 'running', 'active-one', 1,
    'v1', 'v1', 'first'
  );
  begin
    insert into public.ai_jobs(
      user_id, job_type, status, idempotency_key, attempt_count,
      prompt_version, schema_version, input_summary
    ) values (
      user_a, 'store_generation', 'running', 'active-two', 1,
      'v1', 'v1', 'second'
    );
    raise exception 'active_job_constraint_missing';
  exception
    when unique_violation then null;
  end;

  insert into public.ai_jobs(
    id, user_id, job_type, status, idempotency_key, attempt_count,
    prompt_version, schema_version, input_summary, started_at
  ) values (
    generation_job, user_c, 'store_generation', 'running',
    'generation-fence', 2, 'v1', 'v1', 'fenced generation', job_started
  );
  begin
    perform public.persist_generated_store(
      user_c, generation_job, 1, job_started, 'Fence Store', 'fence-store',
      generated_product, 'Fence Product',
      'A sufficiently detailed generated product description.', 25, null,
      jsonb_build_object('productId', generated_product), 'local_preview'
    );
    raise exception 'stale_generation_attempt_was_accepted';
  exception
    when others then
      if sqlerrm not like '%generation_attempt_not_running%' then raise; end if;
  end;
  if exists (
    select 1 from public.stores where owner_id = user_c
  ) then raise exception 'stale_generation_attempt_created_store'; end if;
  perform public.persist_generated_store(
    user_c, generation_job, 2, job_started, 'Fence Store', 'fence-store',
    generated_product, 'Fence Product',
    'A sufficiently detailed generated product description.', 25, null,
    jsonb_build_object('productId', generated_product), 'local_preview'
  );
  if not exists (
    select 1 from public.stores where owner_id = user_c
  ) then raise exception 'current_generation_attempt_did_not_persist'; end if;

  perform public.prepare_event_identity(
    session_a, visitor_a, store_a, false
  );
  begin
    perform public.prepare_event_identity(
      session_a, visitor_a, store_b, false
    );
    raise exception 'session_reassignment_was_accepted';
  exception
    when others then
      if sqlerrm not like '%session_identity_mismatch%' then raise; end if;
  end;
  begin
    insert into public.events(
      id, store_id, visitor_id, session_id, event_type
    ) values (
      gen_random_uuid(), store_b, visitor_a, session_a, 'page_view'
    );
    raise exception 'cross_store_event_was_accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);

do $$
declare
  affected integer;
begin
  if not exists (
    select 1 from public.stores
    where id = '20000000-0000-4000-8000-000000000001'
  ) then raise exception 'owner_cannot_read_store'; end if;
  if exists (
    select 1 from public.stores
    where id = '20000000-0000-4000-8000-000000000002'
  ) then raise exception 'owner_can_read_cross_store'; end if;
  if not exists (
    select 1 from public.products
    where id = '30000000-0000-4000-8000-000000000001'
  ) then raise exception 'owner_cannot_read_product'; end if;
  update public.stores set name = 'Unexpected mutation'
  where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'owner_can_update_store_directly'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;

do $$
begin
  if exists (select 1 from public.stores) then
    raise exception 'anon_can_read_stores';
  end if;
end;
$$;

reset role;

insert into public.rate_limits(key, time_bucket)
values ('expired', now() - interval '3 days');
update public.rate_limit_maintenance
set last_pruned_at = now() - interval '2 hours';
select public.consume_rate_limit('test', date_trunc('hour', now()), 2);

do $$
begin
  if exists (select 1 from public.rate_limits where key = 'expired') then
    raise exception 'expired_rate_limit_was_not_pruned';
  end if;
  if has_function_privilege('anon', 'public.consume_rate_limit(text,timestamptz,integer)', 'execute') then
    raise exception 'anon_can_consume_rate_limit';
  end if;
  if has_function_privilege('authenticated', 'public.prepare_event_identity(uuid,uuid,uuid,boolean)', 'execute') then
    raise exception 'authenticated_can_prepare_event_identity';
  end if;
  if not has_function_privilege('service_role', 'public.prepare_event_identity(uuid,uuid,uuid,boolean)', 'execute') then
    raise exception 'service_role_cannot_prepare_event_identity';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'owners delete product images'
  ) then raise exception 'storage_cleanup_policy_missing'; end if;
end;
$$;
