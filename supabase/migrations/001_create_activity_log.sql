-- supabase/migrations/001_create_activity_log.sql
-- Run this in your Supabase SQL editor once

create table if not exists public.activity_log (
  id            bigserial primary key,
  action        text        not null,          -- 'task_completed', 'deal_stage_moved'
  object_type   text        not null,          -- 'task', 'deal'
  object_id     text        not null,          -- HubSpot object ID
  object_name   text,                          -- Human-readable name
  new_value     text,                          -- New stage name, etc.
  user_email    text,                          -- Who did it (future: per-rep auth)
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Index for fast lookups by date
create index if not exists activity_log_completed_at_idx
  on public.activity_log (completed_at desc);

-- Index for lookups by object
create index if not exists activity_log_object_idx
  on public.activity_log (object_type, object_id);

-- Row Level Security (RLS) — only service role can write, anon can read
alter table public.activity_log enable row level security;

create policy "Service role has full access"
  on public.activity_log
  using (true)
  with check (true);

-- Optional: cache table for API responses (speeds up dashboard load)
create table if not exists public.api_cache (
  cache_key     text        primary key,
  data          jsonb       not null,
  fetched_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists api_cache_expires_idx
  on public.api_cache (expires_at);

comment on table public.activity_log is
  'Logs every action taken from the Sales Dashboard (task completions, deal stage changes).';

comment on table public.api_cache is
  'Optional caching layer for HubSpot + GCal API responses to speed up dashboard loads.';
