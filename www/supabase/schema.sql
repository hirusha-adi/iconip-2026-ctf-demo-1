-- Run this SQL in your Supabase SQL editor.
-- All tables use soft-delete fields where relevant. No hard-delete paths are implemented in app code.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  clerk_user_id text primary key,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  is_verified boolean not null default false,
  verified_at timestamptz,
  is_admin boolean not null default false,
  is_disabled boolean not null default false,
  disabled_reason text,
  disabled_at timestamptz,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.verification_email_events (
  id bigserial primary key,
  email text not null,
  sent_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  clerk_user_id text references public.profiles(clerk_user_id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.password_reset_email_events (
  id bigserial primary key,
  email text not null,
  sent_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null references public.profiles(clerk_user_id),
  title text not null default 'New session',
  is_ended boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id),
  clerk_user_id text not null references public.profiles(clerk_user_id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.auth_events (
  id bigserial primary key,
  clerk_user_id text references public.profiles(clerk_user_id),
  email text,
  event_type text not null,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.route_access_logs (
  id bigserial primary key,
  clerk_user_id text references public.profiles(clerk_user_id),
  path text not null,
  method text not null default 'GET',
  status text not null default 'ok',
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  actor_user_id text references public.profiles(clerk_user_id),
  target_user_id text references public.profiles(clerk_user_id),
  action text not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_last_seen on public.profiles (last_seen_at);
create index if not exists idx_chat_sessions_user on public.chat_sessions (clerk_user_id, updated_at desc);
create index if not exists idx_chat_messages_session on public.chat_messages (session_id, created_at);
create index if not exists idx_auth_events_user on public.auth_events (clerk_user_id, created_at desc);
create index if not exists idx_route_logs_user on public.route_access_logs (clerk_user_id, created_at desc);
create index if not exists idx_route_logs_status on public.route_access_logs (status, created_at desc);
create index if not exists idx_verification_email_events_email on public.verification_email_events (email, sent_at desc);
create index if not exists idx_email_verification_tokens_email on public.email_verification_tokens (email, created_at desc);
create index if not exists idx_password_reset_tokens_email on public.password_reset_tokens (email, created_at desc);
create index if not exists idx_password_reset_tokens_user on public.password_reset_tokens (clerk_user_id, created_at desc);
create index if not exists idx_password_reset_email_events_email on public.password_reset_email_events (email, sent_at desc);
create index if not exists idx_admin_audit_target on public.admin_audit_logs (target_user_id, created_at desc);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_chat_sessions_updated_at on public.chat_sessions;
create trigger trg_chat_sessions_updated_at
before update on public.chat_sessions
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.verification_email_events enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.password_reset_email_events enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.auth_events enable row level security;
alter table public.route_access_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Explicitly deny public role access; app server uses service role key.
revoke all on public.profiles from anon, authenticated;
revoke all on public.email_verification_tokens from anon, authenticated;
revoke all on public.verification_email_events from anon, authenticated;
revoke all on public.password_reset_tokens from anon, authenticated;
revoke all on public.password_reset_email_events from anon, authenticated;
revoke all on public.chat_sessions from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.auth_events from anon, authenticated;
revoke all on public.route_access_logs from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
