create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  name text not null,
  min_days integer not null check (min_days >= 0),
  max_days integer not null check (max_days >= min_days and max_days <= 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index if not exists audiences_restaurant_idx on public.audiences (restaurant_id);

alter table public.campaigns
  add column if not exists audience_id uuid references public.audiences (id) on delete set null;

alter table public.audiences enable row level security;

drop policy if exists audiences_tenant on public.audiences;
create policy audiences_tenant on public.audiences
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
