/**
 * Cria a loja no Supabase e ativa franquia Básico.
 *
 * Pré-requisito: usuário já criado em Supabase → Authentication → Users.
 *
 * Uso (PowerShell, na raiz do projeto):
 *   $env:BOOTSTRAP_OWNER_USER_ID="uuid-do-usuario"
 *   # carregue SUPABASE_* do .env.local ou exporte manualmente
 *   node --env-file=.env.local scripts/bootstrap-restaurant.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const ownerId = process.env.BOOTSTRAP_OWNER_USER_ID?.trim();
const storeName = process.env.BOOTSTRAP_STORE_NAME?.trim() || "Saladeria com Limão e Sal";
const city = process.env.BOOTSTRAP_STORE_CITY?.trim() || "São Paulo";

if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Rode: node --env-file=.env.local scripts/bootstrap-restaurant.mjs");
  process.exit(1);
}

if (!ownerId) {
  console.error("Falta BOOTSTRAP_OWNER_USER_ID (UUID do usuário em Authentication → Users).");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing } = await admin
  .from("restaurants")
  .select("id, name")
  .eq("owner_user_id", ownerId)
  .maybeSingle();

if (existing?.id) {
  console.log(`Loja já existe: ${existing.name} (${existing.id})`);
  const { error: quotaError } = await admin.rpc("ensure_quota_account", {
    p_restaurant_id: existing.id,
  });
  if (quotaError) {
    console.error("ensure_quota_account:", quotaError.message);
    process.exit(1);
  }
  console.log("Franquia Básico confirmada (ensure_quota_account).");
  process.exit(0);
}

const { data: created, error: insertError } = await admin
  .from("restaurants")
  .insert({ name: storeName, city, owner_user_id: ownerId })
  .select("id, name")
  .single();

if (insertError || !created) {
  console.error("Insert restaurant:", insertError?.message ?? "falhou");
  process.exit(1);
}

const { error: quotaError } = await admin.rpc("ensure_quota_account", {
  p_restaurant_id: created.id,
});

if (quotaError) {
  console.error("ensure_quota_account:", quotaError.message);
  process.exit(1);
}

console.log(`Loja criada: ${created.name}`);
console.log(`restaurant_id: ${created.id}`);
console.log("Plano Básico (700 leads/mês) ativo.");
