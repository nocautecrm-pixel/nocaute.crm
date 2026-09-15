-- Additive containment release. Apply before deploying the new workers.
begin;
set local lock_timeout = '5s';

-- All mutations of these records are already server-owned. RLS alone does not
-- restrict writable columns, so revoke direct client writes as well.
revoke all on public.subscriptions, public.quota_accounts, public.quota_ledger,
  public.data_deletion_requests, public.whatsapp_accounts, public.campaign_jobs,
  public.restaurants, public.customers, public.campaigns from public, anon, authenticated;
grant select on public.subscriptions, public.quota_accounts, public.quota_ledger,
  public.campaign_jobs, public.restaurants, public.customers, public.campaigns to authenticated;
grant all on public.subscriptions, public.quota_accounts, public.quota_ledger,
  public.data_deletion_requests, public.whatsapp_accounts, public.campaign_jobs,
  public.restaurants, public.customers, public.campaigns to service_role;
alter table public.data_deletion_requests enable row level security;
drop policy if exists subscriptions_tenant on public.subscriptions;
create policy subscriptions_tenant on public.subscriptions for select to authenticated
  using (restaurant_id = public.current_restaurant_id());
drop policy if exists quota_accounts_tenant on public.quota_accounts;
create policy quota_accounts_tenant on public.quota_accounts for select to authenticated
  using (restaurant_id = public.current_restaurant_id());

create table public.delivery_attempts (
  campaign_job_id uuid not null references public.campaign_jobs(id) on delete cascade,
  phase text not null check (phase in ('initial', 'offer_media', 'offer_cta')),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  state text not null default 'started' check (state in ('started','accepted','uncertain')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  primary key (campaign_job_id, phase)
);
create table public.checkout_attempts (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  plan_slug text not null,
  billing_type text not null,
  state text not null default 'started' check (state in ('started','completed','uncertain')),
  result jsonb,
  created_at timestamptz not null default now()
);
-- Hashes remain personal-data references: restrict access and include them in
-- retention review. They prevent deleted/reimported opt-outs being reactivated.
create table public.customer_suppressions (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  phone_hash bytea not null,
  revoked_at timestamptz not null default now(),
  primary key (restaurant_id, phone_hash)
);
create table public.security_usage_windows (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('import','ai')),
  window_start timestamptz not null,
  requests integer not null default 0,
  lease_until timestamptz,
  lease_token uuid,
  primary key (restaurant_id, kind)
);
alter table public.delivery_attempts enable row level security;
alter table public.checkout_attempts enable row level security;
alter table public.customer_suppressions enable row level security;
alter table public.security_usage_windows enable row level security;
revoke all on public.delivery_attempts, public.checkout_attempts,
  public.customer_suppressions, public.security_usage_windows from public, anon, authenticated;
grant all on public.delivery_attempts, public.checkout_attempts,
  public.customer_suppressions, public.security_usage_windows to service_role;

-- A legacy confirmation may already have sent media before crashing. Hold it
-- for reconciliation rather than guessing that a missing receipt means unsent.
insert into public.delivery_attempts(campaign_job_id,phase,restaurant_id,state)
select j.id,p.phase,j.restaurant_id,'uncertain' from public.campaign_jobs j
cross join (values ('offer_media'),('offer_cta')) as p(phase)
where j.status in ('confirmed','offer_sent') or j.offer_wamid is not null;

insert into public.customer_suppressions(restaurant_id, phone_hash, revoked_at)
select restaurant_id, sha256(convert_to(regexp_replace(phone, '[^0-9]', '', 'g'), 'UTF8')),
  coalesce(opt_in_at, now()) from public.customers
where not opt_in
on conflict do nothing;

create function public.protect_customer_consent() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare h bytea;
begin
  if tg_op = 'DELETE' then
    if not exists(select 1 from public.restaurants where id=old.restaurant_id) then return old; end if;
    insert into public.customer_suppressions(restaurant_id, phone_hash)
    values(old.restaurant_id, sha256(convert_to(regexp_replace(old.phone, '[^0-9]', '', 'g'), 'UTF8')))
    on conflict (restaurant_id, phone_hash) do update set revoked_at = now();
    return old;
  end if;
  h := sha256(convert_to(regexp_replace(new.phone, '[^0-9]', '', 'g'), 'UTF8'));
  if not new.opt_in and (new.opt_in_source = 'recusa_whatsapp' or
      (tg_op = 'UPDATE' and old.opt_in)) then
    insert into public.customer_suppressions(restaurant_id, phone_hash)
    values(new.restaurant_id, h)
    on conflict (restaurant_id, phone_hash) do update set revoked_at = now();
  end if;
  if exists(select 1 from public.customer_suppressions
      where restaurant_id = new.restaurant_id and phone_hash = h) then
    new.opt_in := false;
    new.opt_in_source := 'recusa_whatsapp';
    new.opt_in_proof := 'supressao-persistida';
    select revoked_at into new.opt_in_at from public.customer_suppressions
      where restaurant_id = new.restaurant_id and phone_hash = h;
  end if;
  return new;
end $$;
create trigger customers_consent_guard before insert or update or delete on public.customers
  for each row execute function public.protect_customer_consent();

create function public.restore_customer_consent(p_restaurant_id uuid, p_customer_id uuid,
  p_source text, p_proof text, p_expected_revoked_at timestamptz) returns public.customers language plpgsql set search_path = public, pg_temp as $$
declare c public.customers;
begin
  if length(trim(coalesce(p_source,''))) = 0 or length(trim(coalesce(p_proof,''))) = 0
    or p_source = 'recusa_whatsapp' then raise exception 'Consentimento explícito sem comprovante'; end if;
  select * into strict c from public.customers where id = p_customer_id
    and restaurant_id = p_restaurant_id for update;
  delete from public.customer_suppressions where restaurant_id = p_restaurant_id
    and phone_hash = sha256(convert_to(regexp_replace(c.phone, '[^0-9]', '', 'g'), 'UTF8'))
    and revoked_at = p_expected_revoked_at;
  if not found then raise exception 'Consentimento alterado; atualize a página e registre novo comprovante'; end if;
  update public.customers set opt_in = true, opt_in_at = now(), opt_in_source = p_source,
    opt_in_proof = p_proof where id = c.id returning * into c;
  return c;
end $$;

create function public.claim_delivery(p_restaurant_id uuid, p_campaign_id uuid,
  p_campaign_job_id uuid, p_customer_id uuid, p_phase text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare c public.customers; j public.campaign_jobs; campaign_state text; a public.delivery_attempts;
begin
  if p_phase not in ('initial','offer_media','offer_cta') then raise exception 'Fase inválida'; end if;
  select * into c from public.customers where id = p_customer_id
    and restaurant_id = p_restaurant_id for update;
  if not found then return jsonb_build_object('state','suppressed'); end if;
  select * into j from public.campaign_jobs where id = p_campaign_job_id
    and restaurant_id = p_restaurant_id and campaign_id = p_campaign_id
    and customer_id = p_customer_id for update;
  if not found then return jsonb_build_object('state','suppressed'); end if;
  select * into a from public.delivery_attempts where campaign_job_id = j.id and phase = p_phase;
  -- An acknowledged step can repair local persistence without a new send.
  if found then return jsonb_build_object('state',a.state,'wamid',a.provider_message_id); end if;
  select status into campaign_state from public.campaigns where id = p_campaign_id
    and restaurant_id = p_restaurant_id for share;
  if campaign_state = 'paused' then return jsonb_build_object('state','paused'); end if;
  if campaign_state not in ('running','queued','scheduled') or campaign_state is null
    or not c.opt_in or c.opt_in_at is null or length(trim(coalesce(c.opt_in_source,''))) = 0
    or length(trim(coalesce(c.opt_in_proof,''))) = 0
    or exists(select 1 from public.customer_suppressions where restaurant_id = c.restaurant_id
      and phone_hash = sha256(convert_to(regexp_replace(c.phone, '[^0-9]', '', 'g'), 'UTF8')))
  then return jsonb_build_object('state','suppressed'); end if;
  -- Legacy attempted jobs without an attempt receipt are NOT safe to replay.
  if (p_phase = 'initial' and (j.status <> 'queued' or j.provider_message_id is not null
      or j.sent_at is not null or j.attempts > 0))
    or (p_phase <> 'initial' and j.status <> 'confirmed') then
    return jsonb_build_object('state','held');
  end if;
  insert into public.delivery_attempts(campaign_job_id, phase, restaurant_id)
    values(j.id,p_phase,p_restaurant_id);
  return jsonb_build_object('state','claimed','phone',c.phone,'name',c.name);
end $$;

create function public.confirm_campaign_offer(p_restaurant_id uuid, p_job_id uuid, p_phone text)
returns boolean language plpgsql set search_path = public, pg_temp as $$
declare c public.customers; j public.campaign_jobs;
begin
  select c0.* into c from public.customers c0 join public.campaign_jobs j0 on j0.customer_id=c0.id
    where j0.id=p_job_id and j0.restaurant_id=p_restaurant_id and c0.restaurant_id=p_restaurant_id
    and regexp_replace(c0.phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g') for update of c0;
  if not found or not c.opt_in then return false; end if;
  select * into j from public.campaign_jobs where id=p_job_id and restaurant_id=p_restaurant_id for update;
  if j.status not in ('awaiting_confirm','delivered','read','confirmed') then return false; end if;
  update public.campaign_jobs set status='confirmed',confirmed_at=coalesce(confirmed_at,now()) where id=j.id;
  return true;
end $$;

-- Serialize on the existing job: one terminal outcome, not one per kind.
create or replace function public.settle_campaign_quota(p_restaurant_id uuid, p_kind text,
  p_campaign_id uuid default null, p_campaign_job_id uuid default null) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  if p_kind not in ('consume','refund') or p_campaign_job_id is null then raise exception 'Liquidação inválida'; end if;
  perform 1 from public.campaign_jobs where id=p_campaign_job_id and restaurant_id=p_restaurant_id
    and campaign_id=p_campaign_id for update;
  if not found then raise exception 'Job não encontrado'; end if;
  if exists(select 1 from public.quota_ledger where campaign_job_id=p_campaign_job_id
      and kind in ('consume','refund')) then return; end if;
  perform 1 from public.quota_accounts where restaurant_id=p_restaurant_id for update;
  if not found then raise exception 'Conta de quota ausente'; end if;
  update public.quota_accounts set reserved=greatest(reserved-1,0),
    used=used+case when p_kind='consume' then 1 else 0 end, updated_at=now()
    where restaurant_id=p_restaurant_id;
  insert into public.quota_ledger(restaurant_id,kind,amount,campaign_id,campaign_job_id)
    values(p_restaurant_id,p_kind,1,p_campaign_id,p_campaign_job_id);
end $$;

-- Durable spend/concurrency cap: unavailable DB means no paid AI call.
create function public.claim_import_budget(p_restaurant_id uuid, p_kind text) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare w public.security_usage_windows; token uuid := gen_random_uuid(); cap integer;
begin
  if p_kind not in ('import','ai') then raise exception 'Budget inválido'; end if;
  cap := case when p_kind='ai' then 20 else 100 end;
  insert into public.security_usage_windows(restaurant_id,kind,window_start)
    values(p_restaurant_id,p_kind,date_trunc('day',now())) on conflict do nothing;
  select * into w from public.security_usage_windows where restaurant_id=p_restaurant_id and kind=p_kind for update;
  if w.lease_until > now() then raise exception 'import_busy'; end if;
  if w.window_start < date_trunc('day',now()) then w.requests:=0; end if;
  if w.requests >= cap then raise exception 'import_daily_limit'; end if;
  update public.security_usage_windows set requests=w.requests+1,window_start=date_trunc('day',now()),
    lease_until=now()+interval '2 minutes',lease_token=token
    where restaurant_id=p_restaurant_id and kind=p_kind;
  return token;
end $$;
create function public.release_import_budget(p_restaurant_id uuid,p_kind text,p_token uuid)
returns void language sql set search_path = public, pg_temp as $$
  update public.security_usage_windows set lease_until=null,lease_token=null
  where restaurant_id=p_restaurant_id and kind=p_kind and lease_token=p_token;
$$;

-- Restrict every overload of the named internal commands, including old RPCs.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('ensure_quota_account','reserve_campaign_quota',
      'settle_campaign_quota','release_campaign_quota','apply_subscription_plan','claim_delivery',
      'confirm_campaign_offer','restore_customer_consent','protect_customer_consent',
      'claim_import_budget','release_import_budget') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
