-- MVP: rodar DEPOIS das migrations 0001–0011 e DEPOIS de criar um usuário no Auth.
--
-- 1) Supabase → Authentication → Users → Add user (email/senha)
-- 2) Copie o UUID do usuário
-- 3) Troque abaixo e execute este arquivo no SQL Editor

-- \set owner_id 'COLE-O-UUID-AQUI'  -- psql only; no SQL Editor substitua direto:

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000000'; -- ← TROQUE
  rid uuid;
begin
  if owner_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Substitua owner_id pelo UUID do usuário do Auth';
  end if;

  insert into public.restaurants (name, city, owner_user_id)
  values ('Saladeria com Limão e Sal', 'São Paulo', owner_id)
  on conflict (owner_user_id) do update
    set name = excluded.name,
        city = excluded.city
  returning id into rid;

  if rid is null then
    select id into rid from public.restaurants where owner_user_id = owner_id;
  end if;

  perform public.ensure_quota_account(rid);
  raise notice 'Loja pronta: %', rid;
end $$;
