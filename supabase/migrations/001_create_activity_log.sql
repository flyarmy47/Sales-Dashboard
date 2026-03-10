-- supabase/migrations/001_create_activity_log.sql
create table if not exists public.activity_log (
  id            bigserial primary key,
  action        text        not null,
  object_type   text        not null,
  object_id     text        not null,
  object_name   text,
  new_value     text,
  user_email    text,
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists activity_log_completed_at_idx on public.activity_log (completed_at desc);
alter table public.activity_log enable row level security;
create policy "Service role has full access" on public.activity_log using (true) with check (true);
create table if not exists public.api_cache (
  cache_key     text        primary key,
  data          jsonb       not null,
  fetched_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);