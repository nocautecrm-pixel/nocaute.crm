alter table public.restaurants
  add column if not exists city text,
  add column if not exists logo_url text;
