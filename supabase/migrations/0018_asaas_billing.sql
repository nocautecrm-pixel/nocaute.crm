-- Integração Asaas: IDs externos + idempotência de webhook.
-- Preenche depois: API key / webhook token no .env (não no SQL).

alter table public.restaurants
  add column if not exists asaas_customer_id text,
  add column if not exists billing_cpf_cnpj text;

create unique index if not exists restaurants_asaas_customer_uidx
  on public.restaurants (asaas_customer_id)
  where asaas_customer_id is not null;

alter table public.subscriptions
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_customer_id text,
  add column if not exists billing_type text
    check (billing_type is null or billing_type in ('CREDIT_CARD', 'PIX', 'UNDEFINED')),
  add column if not exists pending_plan_slug text
    references public.plans (slug),
  add column if not exists last_payment_id text,
  add column if not exists last_payment_at timestamptz;

create unique index if not exists subscriptions_asaas_subscription_uidx
  on public.subscriptions (asaas_subscription_id)
  where asaas_subscription_id is not null;

create table if not exists public.billing_webhook_events (
  id text primary key,
  provider text not null default 'asaas',
  event_type text not null,
  payment_id text,
  subscription_id text,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_payment_idx
  on public.billing_webhook_events (payment_id)
  where payment_id is not null;

alter table public.billing_webhook_events enable row level security;

-- Só o service role (gateway) escreve/lê eventos de billing.
-- Sem policy de authenticated: lojista não vê webhooks crus.

create or replace function public.apply_subscription_plan(
  p_restaurant_id uuid,
  p_plan_slug text,
  p_status text default 'active',
  p_asaas_subscription_id text default null,
  p_asaas_customer_id text default null,
  p_billing_type text default null,
  p_last_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.plans;
  period_from timestamptz := date_trunc('month', now());
  period_to timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  if p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'Status de assinatura inválido';
  end if;

  select * into plan_row from public.plans where slug = p_plan_slug;
  if plan_row.id is null then
    raise exception 'Plano % ausente', p_plan_slug;
  end if;

  perform public.ensure_quota_account(p_restaurant_id);

  update public.subscriptions
  set plan_id = plan_row.id,
      status = p_status,
      period_start = period_from,
      period_end = period_to,
      asaas_subscription_id = coalesce(p_asaas_subscription_id, asaas_subscription_id),
      asaas_customer_id = coalesce(p_asaas_customer_id, asaas_customer_id),
      billing_type = coalesce(p_billing_type, billing_type),
      pending_plan_slug = case
        when p_status = 'active' then null
        else pending_plan_slug
      end,
      last_payment_id = coalesce(p_last_payment_id, last_payment_id),
      last_payment_at = case
        when p_last_payment_id is not null then now()
        else last_payment_at
      end,
      updated_at = now()
  where restaurant_id = p_restaurant_id;

  if not found then
    insert into public.subscriptions (
      restaurant_id, plan_id, status, period_start, period_end,
      asaas_subscription_id, asaas_customer_id, billing_type,
      last_payment_id, last_payment_at
    )
    values (
      p_restaurant_id, plan_row.id, p_status, period_from, period_to,
      p_asaas_subscription_id, p_asaas_customer_id, p_billing_type,
      p_last_payment_id, case when p_last_payment_id is not null then now() else null end
    );
  end if;

  update public.quota_accounts
  set plan_id = plan_row.id,
      included = plan_row.included_leads,
      updated_at = now()
  where restaurant_id = p_restaurant_id;

  if p_asaas_customer_id is not null then
    update public.restaurants
    set asaas_customer_id = p_asaas_customer_id
    where id = p_restaurant_id
      and (asaas_customer_id is null or asaas_customer_id = p_asaas_customer_id);
  end if;
end;
$$;

revoke all on function public.apply_subscription_plan(
  uuid, text, text, text, text, text, text
) from public;

grant execute on function public.apply_subscription_plan(
  uuid, text, text, text, text, text, text
) to service_role;
