create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 64),
  owner_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_created_idx
  on public.workspaces (owner_id, created_at desc);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id text not null,
  source text not null,
  event_type text not null default 'memory',
  content text not null default '',
  prompt text not null default '',
  response text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create index if not exists memories_workspace_project_created_idx
  on public.memories (workspace_id, project_id, created_at desc)
  where is_deleted = false;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null default 'MCP / Chrome Extension',
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_workspace_active_idx
  on public.api_keys (workspace_id, owner_id)
  where revoked_at is null;

create table if not exists public.sync_runs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id text not null,
  source_tool text not null,
  last_run_at timestamptz not null default now(),
  items_ingested integer not null default 0,
  unique (workspace_id, project_id, source_tool)
);

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.memories enable row level security;
alter table public.api_keys enable row level security;
alter table public.sync_runs enable row level security;
alter table public.waitlist_signups enable row level security;

revoke all on public.workspaces, public.memories, public.api_keys, public.sync_runs
  from anon, authenticated;
revoke all on public.waitlist_signups from anon, authenticated;

grant all on public.workspaces, public.memories, public.api_keys, public.sync_runs
  to service_role;
grant all on public.waitlist_signups to service_role;
