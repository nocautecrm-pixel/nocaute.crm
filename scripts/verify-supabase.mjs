/**
 * Verifica Supabase: tabelas, usuários Auth, loja existente.
 * Uso: node --env-file=.env.local scripts/verify-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: restaurantError } = await admin.from("restaurants").select("id").limit(1);
if (restaurantError) {
  console.error("Tabela restaurants:", restaurantError.message);
  if (String(restaurantError.message).includes("fetch failed")) {
    console.error("\n→ URL do Supabase inacessível (DNS/rede) ou project ref errado.");
    console.error("  Confira NEXT_PUBLIC_SUPABASE_URL no .env.local (Settings → API no dashboard).");
  } else {
    console.error("\n→ Rode as migrations: npm run setup:db");
  }
  process.exit(1);
}

const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 5 });
if (usersError) {
  console.error("Auth users:", usersError.message);
  process.exit(1);
}

const { data: restaurants } = await admin.from("restaurants").select("id, name, owner_user_id");

console.log("Supabase OK — restaurants acessível.");
console.log(`Usuários Auth: ${users.users.length}`);
for (const u of users.users) {
  console.log(`  - ${u.email ?? u.phone ?? u.id} → ${u.id}`);
}

if ((restaurants ?? []).length) {
  console.log(`Lojas: ${restaurants.length}`);
  for (const r of restaurants ?? []) {
    console.log(`  - ${r.name} (${r.id})`);
  }
} else {
  console.log("Nenhuma loja ainda.");
  if (users.users[0]) {
    console.log("\nPróximo (PowerShell):");
    console.log(`  $env:BOOTSTRAP_OWNER_USER_ID="${users.users[0].id}"`);
    console.log("  npm run setup:store");
  } else {
    console.log("\nPróximo: Supabase → Authentication → Users → Add user");
    console.log("Depois: npm run setup:store com BOOTSTRAP_OWNER_USER_ID");
  }
}
