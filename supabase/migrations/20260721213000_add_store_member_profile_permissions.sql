alter table public.store_members
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists permissions jsonb not null default '{}'::jsonb;

create index if not exists idx_store_members_email on public.store_members(email);
