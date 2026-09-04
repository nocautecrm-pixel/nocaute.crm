alter table public.customers
  add column if not exists order_count integer not null default 0;

alter table public.customers
  drop constraint if exists customers_order_count_check;

alter table public.customers
  add constraint customers_order_count_check
  check (order_count >= 0);

comment on column public.customers.order_count is
  'Quantidade de pedidos conhecida da loja (planilha ou visita registrada).';
