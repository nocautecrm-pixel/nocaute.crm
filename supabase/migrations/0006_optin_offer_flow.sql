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
