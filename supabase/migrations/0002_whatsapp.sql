create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone text,
  access_token_encrypted text not null,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'restricted', 'disconnected')),
  quality_rating text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
