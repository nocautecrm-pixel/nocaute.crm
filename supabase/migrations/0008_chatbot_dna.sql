alter table public.whatsapp_accounts
  add column if not exists last_inbound_at timestamptz;

create table if not exists public.chatbot_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  personality text not null default '',
  tone text not null default 'descontraido'
    check (tone in ('descontraido', 'objetivo', 'premium', 'formal')),
  detail_level text not null default 'medio'
    check (detail_level in ('curto', 'medio', 'completo')),
  emojis boolean not null default true,
  greeting text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chatbot_profiles enable row level security;

create policy chatbot_profiles_tenant on public.chatbot_profiles
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
