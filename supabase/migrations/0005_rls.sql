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
