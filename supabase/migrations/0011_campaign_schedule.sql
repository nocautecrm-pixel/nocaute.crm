alter table public.campaigns
  add column if not exists starts_at timestamptz;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'queued', 'scheduled', 'running', 'paused', 'done', 'failed'));
