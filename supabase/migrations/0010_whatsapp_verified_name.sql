-- Nome que a Meta mostra no WhatsApp (verified_name)
alter table public.whatsapp_accounts
  add column if not exists verified_name text;
