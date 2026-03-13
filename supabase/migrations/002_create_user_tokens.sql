-- Stores per-user Google OAuth refresh tokens
-- Used by calendar functions to fetch each rep's calendar

create table if not exists public.user_tokens (
  id            bigserial primary key,
  user_email    text        not null unique,  -- e.g. thomas@launchhouse.golf
  provider      text        not null default 'google',
  refresh_token text        not null,         -- Google OAuth refresh token
  scopes        text        not null default 'https://www.googleapis.com/auth/calendar',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only service role can read/write tokens (never expose to frontend)
alter table public.user_tokens enable row level security;

create policy "Service role only"
  on public.user_tokens
  using (true)
  with check (true);

-- Index for fast lookup by email
create index if not exists user_tokens_email_idx
  on public.user_tokens (user_email);
