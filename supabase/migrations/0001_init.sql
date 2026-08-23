create extension if not exists "pgcrypto";

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  phone text not null,
  last_purchase_at timestamptz,
  opt_in boolean not null default false,
  opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, phone),
  constraint customers_phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index if not exists customers_restaurant_recency_idx
  on public.customers (restaurant_id, last_purchase_at);

create index if not exists customers_restaurant_opt_in_idx
  on public.customers (restaurant_id, opt_in);
