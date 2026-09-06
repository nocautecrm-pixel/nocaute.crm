-- ========== 0001_init.sql ==========
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


-- ========== 0002_whatsapp.sql ==========
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


-- ========== 0003_campaigns.sql ==========
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  segment text not null
    check (segment in ('ativos', 'em_risco', 'inativos', 'perdidos')),
  template_name text not null,
  template_language text not null default 'pt_BR',
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'paused', 'done', 'failed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz
);

create index if not exists campaigns_restaurant_status_idx
  on public.campaigns (restaurant_id, status);

create table if not exists public.campaign_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  coupon_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  provider_message_id text,
  error_code text,
  error_message text,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (campaign_id, customer_id)
);

create index if not exists campaign_jobs_queue_idx
  on public.campaign_jobs (status, scheduled_at);

create index if not exists campaign_jobs_wamid_idx
  on public.campaign_jobs (provider_message_id);


-- ========== 0004_coupons.sql ==========
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


-- ========== 0005_rls.sql ==========
alter table public.restaurants enable row level security;
alter table public.customers enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_jobs enable row level security;
alter table public.coupons enable row level security;
alter table public.message_events enable row level security;

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
as $$
  select id from public.restaurants where owner_user_id = auth.uid() limit 1
$$;

create policy restaurants_owner on public.restaurants
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy customers_tenant on public.customers
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy whatsapp_accounts_tenant on public.whatsapp_accounts
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy campaigns_tenant on public.campaigns
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy campaign_jobs_tenant on public.campaign_jobs
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy coupons_tenant on public.coupons
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy message_events_tenant on public.message_events
  for select using (restaurant_id = public.current_restaurant_id());


-- ========== 0006_optin_offer_flow.sql ==========
alter table public.campaigns
  add column if not exists establishment_name text not null default 'Saladeria com Limão e Sal',
  add column if not exists promo_code text not null default 'LIMAO15',
  add column if not exists offer_body text not null default 'A semana pede algo fresco. Por isso você foi escolhido para ganhar {{desconto}} nas saladas da casa.

Seu cupom exclusivo: *{{cupom}}*

Mostre este código no caixa ou toque no botão para resgatar.',
  add column if not exists media_type text check (media_type in ('image', 'video')),
  add column if not exists media_url text,
  add column if not exists media_caption text,
  add column if not exists cta_url text,
  add column if not exists cta_label text not null default 'Resgatar Cupom',
  add column if not exists discount_label text not null default '15% OFF';

alter table public.campaign_jobs drop constraint if exists campaign_jobs_status_check;

alter table public.campaign_jobs
  add constraint campaign_jobs_status_check
  check (status in (
    'queued',
    'sending',
    'awaiting_confirm',
    'confirmed',
    'offer_sent',
    'delivered',
    'read',
    'failed',
    'skipped'
  ));

alter table public.campaign_jobs
  add column if not exists optin_wamid text,
  add column if not exists offer_wamid text,
  add column if not exists confirmed_at timestamptz;

create index if not exists campaign_jobs_optin_wamid_idx
  on public.campaign_jobs (optin_wamid);

create index if not exists customers_phone_digits_idx
  on public.customers (restaurant_id, phone);


-- ========== 0007_store_profile.sql ==========
alter table public.restaurants
  add column if not exists city text,
  add column if not exists logo_url text;


-- ========== 0008_chatbot_dna.sql ==========
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


-- ========== 0009_billing_quota.sql ==========
-- Planos de software (franquia da ferramenta, não da Meta)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null,
  included_leads integer not null,
  created_at timestamptz not null default now()
);

insert into public.plans (slug, name, price_cents, included_leads)
values
  ('basico', 'Básico', 19000, 1000),
  ('custom', 'Custom', 24900, 1800),
  ('pro', 'Pro', 29900, 3000)
on conflict (slug) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      included_leads = excluded.included_leads;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quota_accounts (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  included integer not null,
  extra integer not null default 0,
  used integer not null default 0,
  reserved integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint quota_accounts_non_negative check (
    included >= 0 and extra >= 0 and used >= 0 and reserved >= 0
  )
);

create table if not exists public.quota_ledger (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null check (kind in ('reserve', 'consume', 'refund', 'grant_extra', 'cycle_reset')),
  amount integer not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  campaign_job_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists quota_ledger_restaurant_idx
  on public.quota_ledger (restaurant_id, created_at desc);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.quota_accounts enable row level security;
alter table public.quota_ledger enable row level security;

create policy plans_read on public.plans for select using (true);

create policy subscriptions_tenant on public.subscriptions
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy quota_accounts_tenant on public.quota_accounts
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy quota_ledger_tenant on public.quota_ledger
  for select using (restaurant_id = public.current_restaurant_id());

create or replace function public.ensure_quota_account(p_restaurant_id uuid)
returns public.quota_accounts
language plpgsql
as $$
declare
  acc public.quota_accounts;
  plan_row public.plans;
  period_from timestamptz := date_trunc('month', now());
  period_to timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  select * into plan_row from public.plans where slug = 'basico';
  if plan_row.id is null then
    raise exception 'Plano básico ausente';
  end if;

  insert into public.quota_accounts (
    restaurant_id, plan_id, included, extra, used, reserved, period_start, period_end
  )
  values (
    p_restaurant_id, plan_row.id, plan_row.included_leads, 0, 0, 0, period_from, period_to
  )
  on conflict (restaurant_id) do nothing;

  insert into public.subscriptions (
    restaurant_id, plan_id, status, period_start, period_end
  )
  values (
    p_restaurant_id, plan_row.id, 'active', period_from, period_to
  )
  on conflict (restaurant_id) do nothing;

  select * into acc from public.quota_accounts where restaurant_id = p_restaurant_id;

  if acc.period_end <= now() then
    update public.quota_accounts
    set used = 0,
        reserved = 0,
        extra = 0,
        included = plan_row.included_leads,
        period_start = period_from,
        period_end = period_to,
        updated_at = now()
    where restaurant_id = p_restaurant_id
    returning * into acc;

    insert into public.quota_ledger (restaurant_id, kind, amount, note)
    values (p_restaurant_id, 'cycle_reset', 0, 'Novo ciclo mensal');

    update public.subscriptions
    set period_start = period_from,
        period_end = period_to,
        updated_at = now()
    where restaurant_id = p_restaurant_id;
  end if;

  return acc;
end;
$$;

create or replace function public.reserve_campaign_quota(
  p_restaurant_id uuid,
  p_leads integer,
  p_campaign_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  acc public.quota_accounts;
  remaining integer;
begin
  if p_leads < 1 then
    raise exception 'Quantidade de leads inválida';
  end if;

  acc := public.ensure_quota_account(p_restaurant_id);
  select * into acc from public.quota_accounts where restaurant_id = p_restaurant_id for update;

  remaining := acc.included + acc.extra - acc.used - acc.reserved;
  if remaining < p_leads then
    raise exception using
      errcode = 'P0001',
      message = format(
        'quota_exceeded:%s:%s:%s:%s',
        remaining,
        p_leads,
        acc.included,
        acc.plan_id
      );
  end if;

  update public.quota_accounts
  set reserved = reserved + p_leads, updated_at = now()
  where restaurant_id = p_restaurant_id;

  insert into public.quota_ledger (restaurant_id, kind, amount, campaign_id, note)
  values (p_restaurant_id, 'reserve', p_leads, p_campaign_id, 'Reserva de campanha');

  return jsonb_build_object(
    'ok', true,
    'remaining', remaining - p_leads,
    'included', acc.included,
    'used', acc.used,
    'reserved', acc.reserved + p_leads
  );
end;
$$;

create or replace function public.settle_campaign_quota(
  p_restaurant_id uuid,
  p_kind text,
  p_campaign_id uuid default null,
  p_campaign_job_id uuid default null
)
returns void
language plpgsql
as $$
begin
  if p_kind not in ('consume', 'refund') then
    raise exception 'Kind inválido';
  end if;

  perform public.ensure_quota_account(p_restaurant_id);
  perform 1 from public.quota_accounts where restaurant_id = p_restaurant_id for update;

  if p_kind = 'consume' then
    update public.quota_accounts
    set reserved = greatest(reserved - 1, 0),
        used = used + 1,
        updated_at = now()
    where restaurant_id = p_restaurant_id;
  else
    update public.quota_accounts
    set reserved = greatest(reserved - 1, 0),
        updated_at = now()
    where restaurant_id = p_restaurant_id;
  end if;

  insert into public.quota_ledger (restaurant_id, kind, amount, campaign_id, campaign_job_id)
  values (p_restaurant_id, p_kind, 1, p_campaign_id, p_campaign_job_id);
end;
$$;

create or replace function public.release_campaign_quota(
  p_restaurant_id uuid,
  p_leads integer,
  p_campaign_id uuid default null
)
returns void
language plpgsql
as $$
begin
  if p_leads < 1 then
    return;
  end if;
  perform public.ensure_quota_account(p_restaurant_id);
  perform 1 from public.quota_accounts where restaurant_id = p_restaurant_id for update;
  update public.quota_accounts
  set reserved = greatest(reserved - p_leads, 0),
      updated_at = now()
  where restaurant_id = p_restaurant_id;
  insert into public.quota_ledger (restaurant_id, kind, amount, campaign_id, note)
  values (p_restaurant_id, 'refund', p_leads, p_campaign_id, 'Liberação após falha ao montar campanha');
end;
$$;


-- ========== 0010_whatsapp_verified_name.sql ==========
-- Nome que a Meta mostra no WhatsApp (verified_name)
alter table public.whatsapp_accounts
  add column if not exists verified_name text;


-- ========== 0011_campaign_schedule.sql ==========
alter table public.campaigns
  add column if not exists starts_at timestamptz;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'queued', 'scheduled', 'running', 'paused', 'done', 'failed'));


-- ========== 0012_optin_compliance.sql ==========
-- Opt-in audit trail exigido pela política Meta (warm base)
alter table public.customers
  add column if not exists opt_in_source text,
  add column if not exists opt_in_proof text;

comment on column public.customers.opt_in_source is
  'Origem do consentimento: balcao, delivery, reserva, wifi, confirmacao_whatsapp';
comment on column public.customers.opt_in_proof is
  'Comprovante auditável: nº pedido, reserva, ticket Wi-Fi, etc.';

-- Backfill de bases legadas antes da constraint
update public.customers
set
  opt_in_source = coalesce(opt_in_source, 'balcao'),
  opt_in_proof = coalesce(opt_in_proof, 'migracao-legado'),
  opt_in_at = coalesce(opt_in_at, created_at)
where opt_in = true
  and (
    opt_in_source is null
    or opt_in_proof is null
    or opt_in_at is null
  );

-- Opt-in verdadeiro exige data + origem + comprovante
alter table public.customers drop constraint if exists customers_opt_in_audit_check;
alter table public.customers
  add constraint customers_opt_in_audit_check
  check (
    opt_in = false
    or (
      opt_in_at is not null
      and opt_in_source is not null
      and length(trim(opt_in_source)) > 0
      and opt_in_proof is not null
      and length(trim(opt_in_proof)) > 0
    )
  );

create index if not exists customers_restaurant_opt_in_audit_idx
  on public.customers (restaurant_id, opt_in)
  where opt_in = true;

-- Pedidos de exclusão de dados (Meta Data Deletion Callback)
create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  meta_user_id text,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists data_deletion_requests_code_idx
  on public.data_deletion_requests (confirmation_code);

-- ID do usuário Meta (para deauth callback)
alter table public.whatsapp_accounts
  add column if not exists meta_user_id text;

create index if not exists whatsapp_accounts_meta_user_idx
  on public.whatsapp_accounts (meta_user_id)
  where meta_user_id is not null;

-- Status intermediário após envio de template warm base
alter table public.campaign_jobs drop constraint if exists campaign_jobs_status_check;
alter table public.campaign_jobs
  add constraint campaign_jobs_status_check
  check (status in (
    'queued',
    'sending',
    'sent',
    'awaiting_confirm',
    'confirmed',
    'offer_sent',
    'delivered',
    'read',
    'failed',
    'skipped'
  ));


-- ========== 0013_media_storage.sql ==========
-- Bucket público para logo e criativos (Vercel não persiste disco local).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  16777216,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read
  on storage.objects
  for select
  using (bucket_id = 'media');


-- ========== 0014_store_ops.sql ==========
-- Perfil operacional da loja (cardápio, endereço, horário) para campanha e chatbot.
alter table public.restaurants
  add column if not exists menu_url text,
  add column if not exists address text,
  add column if not exists hours_text text;


-- ========== 0015_audiences.sql ==========
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


-- ========== 0016_customer_order_count.sql ==========
alter table public.customers
  add column if not exists order_count integer not null default 0;

alter table public.customers
  drop constraint if exists customers_order_count_check;

alter table public.customers
  add constraint customers_order_count_check
  check (order_count >= 0);

comment on column public.customers.order_count is
  'Quantidade de pedidos conhecida da loja (planilha ou visita registrada).';


-- ========== 0017_customers_imported_at.sql ==========
alter table public.restaurants
  add column if not exists customers_imported_at timestamptz;

comment on column public.restaurants.customers_imported_at is
  'Última vez que a loja importou a planilha de clientes. O aviso de lista velha usa só essa data.';

-- Lojas que já têm base não acordam com alarme falso: o ciclo de 30 dias começa agora.
update public.restaurants as restaurant
set customers_imported_at = now()
where restaurant.customers_imported_at is null
  and exists (
    select 1
    from public.customers as customer
    where customer.restaurant_id = restaurant.id
  );
