-- Perfil operacional da loja (cardápio, endereço, horário) para campanha e chatbot.
alter table public.restaurants
  add column if not exists menu_url text,
  add column if not exists address text,
  add column if not exists hours_text text;
