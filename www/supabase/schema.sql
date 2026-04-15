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

create table if not exists public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id),
  session_id uuid not null references public.chat_sessions(id),
  clerk_user_id text not null references public.profiles(clerk_user_id),
  kind text not null check (kind in ('image', 'video')),
  original_filename text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  duration_seconds numeric(8,3),
  storage_bucket text not null,
  storage_path text not null unique,
  storage_file_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  check (
    (kind = 'image' and byte_size <= 3145728 and duration_seconds is null)
    or
    (kind = 'video' and byte_size <= 8388608 and duration_seconds is not null and duration_seconds > 0 and duration_seconds <= 30)
  )
);

create table if not exists public.persuasion_attempts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null references public.profiles(clerk_user_id),
  session_id uuid not null references public.chat_sessions(id),
  user_message_id uuid not null unique references public.chat_messages(id),
  assistant_message_id uuid references public.chat_messages(id),
  submission_hash text not null,
  input_modality text not null check (input_modality in ('text', 'image', 'article', 'news', 'video', 'deepfake', 'mixed', 'none')),
  is_relevant boolean not null default false,
  is_duplicate boolean not null default false,
  model_rating integer not null default 0 check (model_rating >= 0 and model_rating <= 10),
  awarded_points integer not null default 0 check (awarded_points >= 0 and awarded_points <= 10),
  evidence_preview text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.persuasion_user_scores (
  clerk_user_id text primary key references public.profiles(clerk_user_id),
  total_points integer not null default 0 check (total_points >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.persuasion_global_score (
  singleton boolean primary key default true check (singleton = true),
  total_points integer not null default 0 check (total_points >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.persuasion_global_score (singleton, total_points)
values (true, 0)
on conflict (singleton) do nothing;

create or replace function public.record_persuasion_attempt(
  p_clerk_user_id text,
  p_session_id uuid,
  p_user_message_id uuid,
  p_assistant_message_id uuid,
  p_submission_hash text,
  p_input_modality text,
  p_is_relevant boolean,
  p_is_duplicate boolean,
  p_model_rating integer,
  p_awarded_points integer,
  p_evidence_preview text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  attempt_id uuid,
  awarded_points integer,
  user_total_points integer,
  global_total_points integer
)
language plpgsql
as $$
declare
  v_awarded integer := greatest(0, least(10, coalesce(p_awarded_points, 0)));
  v_rating integer := greatest(0, least(10, coalesce(p_model_rating, 0)));
  v_user_total integer;
  v_global_total integer;
  v_attempt_id uuid;
begin
  if not coalesce(p_is_relevant, false) or coalesce(p_is_duplicate, false) then
    v_awarded := 0;
  end if;

  insert into public.persuasion_attempts (
    clerk_user_id,
    session_id,
    user_message_id,
    assistant_message_id,
    submission_hash,
    input_modality,
    is_relevant,
    is_duplicate,
    model_rating,
    awarded_points,
    evidence_preview,
    metadata
  )
  values (
    p_clerk_user_id,
    p_session_id,
    p_user_message_id,
    p_assistant_message_id,
    p_submission_hash,
    p_input_modality,
    coalesce(p_is_relevant, false),
    coalesce(p_is_duplicate, false),
    v_rating,
    v_awarded,
    p_evidence_preview,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_attempt_id;

  insert into public.persuasion_user_scores as s (clerk_user_id, total_points, updated_at)
  values (p_clerk_user_id, v_awarded, timezone('utc', now()))
  on conflict (clerk_user_id)
  do update set
    total_points = s.total_points + excluded.total_points,
    updated_at = timezone('utc', now())
  returning total_points into v_user_total;

  insert into public.persuasion_global_score as g (singleton, total_points, updated_at)
  values (true, v_awarded, timezone('utc', now()))
  on conflict (singleton)
  do update set
    total_points = g.total_points + excluded.total_points,
    updated_at = timezone('utc', now())
  returning total_points into v_global_total;

  return query
  select
    v_attempt_id,
    v_awarded,
    v_user_total,
    v_global_total;
end;
$$;

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
create index if not exists idx_chat_message_attachments_user_created on public.chat_message_attachments (clerk_user_id, created_at desc);
create index if not exists idx_chat_message_attachments_session_created on public.chat_message_attachments (session_id, created_at);
create index if not exists idx_chat_message_attachments_message_created on public.chat_message_attachments (message_id, created_at);
create index if not exists idx_persuasion_attempts_user_created on public.persuasion_attempts (clerk_user_id, created_at desc);
create index if not exists idx_persuasion_attempts_hash on public.persuasion_attempts (submission_hash);
create index if not exists idx_persuasion_attempts_awarded on public.persuasion_attempts (awarded_points desc, created_at desc);
create index if not exists idx_persuasion_user_scores_points on public.persuasion_user_scores (total_points desc, updated_at desc);
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
alter table public.chat_message_attachments enable row level security;
alter table public.persuasion_attempts enable row level security;
alter table public.persuasion_user_scores enable row level security;
alter table public.persuasion_global_score enable row level security;
alter table public.auth_events enable row level security;
alter table public.route_access_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Attachment media storage bucket for chat uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Explicitly deny public role access; app server uses service role key.
revoke all on public.profiles from anon, authenticated;
revoke all on public.email_verification_tokens from anon, authenticated;
revoke all on public.verification_email_events from anon, authenticated;
revoke all on public.password_reset_tokens from anon, authenticated;
revoke all on public.password_reset_email_events from anon, authenticated;
revoke all on public.chat_sessions from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_message_attachments from anon, authenticated;
revoke all on public.persuasion_attempts from anon, authenticated;
revoke all on public.persuasion_user_scores from anon, authenticated;
revoke all on public.persuasion_global_score from anon, authenticated;
revoke all on public.auth_events from anon, authenticated;
revoke all on public.route_access_logs from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
