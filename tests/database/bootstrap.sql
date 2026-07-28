create role anon;
create role authenticated;
create role service_role;

create schema auth;
create table auth.users (
  id uuid primary key
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);

create function storage.foldername(value text) returns text[]
language sql immutable
as $$
  select regexp_split_to_array(value, '/')
$$;

alter table storage.objects enable row level security;
