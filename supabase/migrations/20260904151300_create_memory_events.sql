create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  source_tool text not null,
  event_type text not null default 'memory',
  user_prompt text not null default '',
  ai_response text not null default '',
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memory_events_project_timestamp_idx
  on public.memory_events (project_id, timestamp desc);

create index if not exists memory_events_source_tool_idx
  on public.memory_events (source_tool);

alter table public.memory_events enable row level security;

create policy "Backend service role can manage memory events"
  on public.memory_events
  for all
  to service_role
  using (true)
  with check (true);
