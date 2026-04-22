create table if not exists public.dashboard_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.dashboard_documents enable row level security;

drop policy if exists "Users can read own dashboard" on public.dashboard_documents;
create policy "Users can read own dashboard"
on public.dashboard_documents
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own dashboard" on public.dashboard_documents;
create policy "Users can insert own dashboard"
on public.dashboard_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own dashboard" on public.dashboard_documents;
create policy "Users can update own dashboard"
on public.dashboard_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dashboard_documents_updated_at on public.dashboard_documents;
create trigger set_dashboard_documents_updated_at
before update on public.dashboard_documents
for each row
execute function public.set_updated_at();
