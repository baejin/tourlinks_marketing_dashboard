create table if not exists public.dashboard_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.dashboard_projects enable row level security;

drop policy if exists "Users can read own projects" on public.dashboard_projects;
create policy "Users can read own projects"
on public.dashboard_projects
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.dashboard_projects;
create policy "Users can insert own projects"
on public.dashboard_projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.dashboard_projects;
create policy "Users can update own projects"
on public.dashboard_projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.dashboard_projects;
create policy "Users can delete own projects"
on public.dashboard_projects
for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dashboard_projects_updated_at on public.dashboard_projects;
create trigger set_dashboard_projects_updated_at
before update on public.dashboard_projects
for each row
execute function public.set_updated_at();

do $$
begin
  if to_regclass('public.dashboard_documents') is not null then
    insert into public.dashboard_projects (user_id, name, payload, created_at, updated_at)
    select user_id, '기본 프로젝트', payload, created_at, updated_at
    from public.dashboard_documents
    on conflict (user_id, name) do nothing;
  end if;
end $$;
