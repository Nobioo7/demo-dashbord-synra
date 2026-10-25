create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;

drop policy if exists "Backend service role can manage waitlist signups"
  on public.waitlist_signups;

create policy "Backend service role can manage waitlist signups"
  on public.waitlist_signups
  for all
  to service_role
  using (true)
  with check (true);
