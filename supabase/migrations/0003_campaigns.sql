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
