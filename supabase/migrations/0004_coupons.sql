create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  code text not null unique,
  discount_label text not null default '10% OFF',
  status text not null default 'issued'
    check (status in ('issued', 'redeemed', 'expired')),
  redeemed_at timestamptz,
  redeemed_via text check (redeemed_via in ('inbound_whatsapp', 'manual_pos')),
  unique (campaign_id, customer_id)
);

create index if not exists coupons_code_idx on public.coupons (code);

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  provider_event_id text not null unique,
  wamid text,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
