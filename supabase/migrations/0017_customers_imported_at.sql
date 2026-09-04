alter table public.restaurants
  add column if not exists customers_imported_at timestamptz;

comment on column public.restaurants.customers_imported_at is
  'Última vez que a loja importou a planilha de clientes. O aviso de lista velha usa só essa data.';

-- Lojas que já têm base não acordam com alarme falso: o ciclo de 30 dias começa agora.
update public.restaurants as restaurant
set customers_imported_at = now()
where restaurant.customers_imported_at is null
  and exists (
    select 1
    from public.customers as customer
    where customer.restaurant_id = restaurant.id
  );
