-- Catálogo final: Básico / Custom / Pro.

insert into public.plans (slug, name, price_cents, included_leads)
values
  ('basico', 'Básico', 19000, 1000),
  ('custom', 'Custom', 24900, 1800),
  ('pro', 'Pro', 29900, 3000)
on conflict (slug) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      included_leads = excluded.included_leads;

-- pending_plan_slug legados
update public.subscriptions set pending_plan_slug = 'custom'
where pending_plan_slug in ('intermediario');

update public.subscriptions set pending_plan_slug = 'pro'
where pending_plan_slug in ('avancado');

-- Migra plan_id de slugs antigos e remove linhas órfãs do catálogo.
do $$
declare
  src uuid;
  dst uuid;
begin
  -- intermediario → custom
  select id into src from public.plans where slug = 'intermediario';
  select id into dst from public.plans where slug = 'custom';
  if src is not null and dst is not null then
    update public.subscriptions set plan_id = dst where plan_id = src;
    update public.quota_accounts set plan_id = dst, included = 1800 where plan_id = src;
    delete from public.plans where id = src;
  end if;

  -- avancado → pro
  select id into src from public.plans where slug = 'avancado';
  select id into dst from public.plans where slug = 'pro';
  if src is not null and dst is not null then
    update public.subscriptions set plan_id = dst where plan_id = src;
    update public.quota_accounts set plan_id = dst, included = 3000 where plan_id = src;
    delete from public.plans where id = src;
  end if;
end;
$$;

update public.quota_accounts qa
set included = p.included_leads,
    updated_at = now()
from public.plans p
where qa.plan_id = p.id
  and qa.included is distinct from p.included_leads;
