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
