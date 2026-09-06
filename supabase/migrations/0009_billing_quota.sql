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
