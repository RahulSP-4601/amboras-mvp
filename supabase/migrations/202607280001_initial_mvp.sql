create extension if not exists pgcrypto;

create type public.store_status as enum ('draft', 'published', 'archived');
create type public.version_status as enum ('draft', 'published', 'archived');
create type public.ai_job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.event_type as enum (
  'page_view', 'product_view', 'scroll_50', 'cta_click',
  'checkout_started', 'conversion_completed'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.store_status not null default 'draft',
  current_draft_version_id uuid,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null check (char_length(description) between 20 and 2500),
  price numeric(12,2) check (price > 0),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  config jsonb not null,
  status public.version_status not null default 'draft',
  source text not null check (source in ('ai_generation', 'manual_edit', 'ai_edit', 'rollback', 'experiment')),
  parent_version_id uuid references public.store_versions(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (store_id, version_number)
);

alter table public.stores
  add constraint stores_current_draft_fk
  foreign key (current_draft_version_id) references public.store_versions(id),
  add constraint stores_current_published_fk
  foreign key (current_published_version_id) references public.store_versions(id);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_type text not null,
  status public.ai_job_status not null default 'queued',
  current_stage text not null default 'validating_product',
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  model text,
  prompt_version text not null,
  schema_version text not null,
  input_summary text not null,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, job_type, idempotency_key)
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  base_store_version_id uuid not null references public.store_versions(id),
  name text not null,
  hypothesis text not null,
  target_metric text not null default 'conversion_rate',
  status text not null check (status in ('draft', 'ready', 'running', 'stopped', 'completed', 'cancelled')),
  winning_variant_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index experiments_one_running_per_store
  on public.experiments(store_id) where status = 'running';

create table public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  name text not null check (name in ('A', 'B')),
  is_control boolean not null,
  patch jsonb not null default '{}'::jsonb,
  traffic_basis_points integer not null check (traffic_basis_points between 0 and 10000),
  unique (experiment_id, name)
);

alter table public.experiments
  add constraint experiments_winner_fk
  foreign key (winning_variant_id) references public.experiment_variants(id);

create table public.visitors (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  synthetic boolean not null default false
);

create table public.visitor_assignments (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  variant_id uuid not null references public.experiment_variants(id),
  assigned_at timestamptz not null default now(),
  unique (visitor_id, experiment_id)
);

create table public.sessions (
  id uuid primary key,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synthetic boolean not null default false
);

create table public.events (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  visitor_id uuid not null references public.visitors(id),
  session_id uuid not null references public.sessions(id),
  experiment_id uuid references public.experiments(id),
  variant_id uuid references public.experiment_variants(id),
  event_type public.event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create index events_store_created_idx on public.events(store_id, created_at desc);
create index events_experiment_variant_idx on public.events(experiment_id, variant_id, event_type);
create index sessions_store_started_idx on public.sessions(store_id, started_at desc);

create table public.experiment_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  metrics jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  action_type text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  summary text not null,
  related_entity_id uuid,
  actor text not null check (actor in ('user', 'ai', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  time_bucket timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (key, time_bucket)
);

create or replace function public.consume_rate_limit(
  limit_key text,
  bucket timestamptz,
  request_limit integer
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare next_count integer;
begin
  insert into public.rate_limits(key, time_bucket, request_count)
  values (limit_key, bucket, 1)
  on conflict (key, time_bucket)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into next_count;
  return next_count <= request_limit;
end;
$$;

create or replace function public.owns_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores
    where id = target_store_id and owner_id = auth.uid()
  );
$$;

create or replace function public.publish_store_version(
  target_store_id uuid,
  target_version_id uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare current_published uuid;
begin
  if not public.owns_store(target_store_id) then
    raise exception 'store_not_owned';
  end if;

  select current_published_version_id into current_published
  from public.stores where id = target_store_id for update;

  if not exists (
    select 1 from public.store_versions
    where id = target_version_id and store_id = target_store_id and status = 'draft'
  ) then
    raise exception 'invalid_draft';
  end if;

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

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.store_versions enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_variants enable row level security;
alter table public.visitors enable row level security;
alter table public.visitor_assignments enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.experiment_metric_snapshots enable row level security;
alter table public.ai_actions enable row level security;
alter table public.rate_limits enable row level security;

create policy "profiles own row" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "owners manage stores" on public.stores
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage products" on public.products
  for all using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy "owners manage versions" on public.store_versions
  for all using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy "owners manage jobs" on public.ai_jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage experiments" on public.experiments
  for all using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy "owners read variants" on public.experiment_variants
  for select using (
    exists (
      select 1 from public.experiments e
      where e.id = experiment_id and public.owns_store(e.store_id)
    )
  );
create policy "owners read sessions" on public.sessions
  for select using (public.owns_store(store_id));
create policy "owners read events" on public.events
  for select using (public.owns_store(store_id));
create policy "owners manage actions" on public.ai_actions
  for all using (public.owns_store(store_id)) with check (public.owns_store(store_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

create policy "owners upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public reads product images" on storage.objects
  for select using (bucket_id = 'product-images');
