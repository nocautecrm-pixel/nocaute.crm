/**
 * Cria usuário inicial no Supabase Auth (se ainda não existir).
 *
 * Uso (PowerShell):
 *   $env:BOOTSTRAP_USER_EMAIL="voce@email.com"
 *   $env:BOOTSTRAP_USER_PASSWORD="senha-forte-123"
 *   npm run setup:user
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.BOOTSTRAP_USER_EMAIL?.trim();
const password = process.env.BOOTSTRAP_USER_PASSWORD?.trim();

if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

if (!email || !password) {
  console.error("Defina BOOTSTRAP_USER_EMAIL e BOOTSTRAP_USER_PASSWORD antes de rodar.");
  console.error('Ex.: $env:BOOTSTRAP_USER_EMAIL="admin@saladeria.com"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Senha deve ter pelo menos 8 caracteres.");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  console.error("listUsers:", listError.message);
  process.exit(1);
}

const existing = listed.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

if (existing) {
  console.log(`Usuário já existe: ${existing.email}`);
  console.log(`BOOTSTRAP_OWNER_USER_ID=${existing.id}`);
  process.exit(0);
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError || !created.user) {
  console.error("createUser:", createError?.message ?? "falhou");
  process.exit(1);
}

console.log(`Usuário criado: ${created.user.email}`);
console.log(`BOOTSTRAP_OWNER_USER_ID=${created.user.id}`);
console.log("");
console.log("Próximo:");
console.log(`  $env:BOOTSTRAP_OWNER_USER_ID="${created.user.id}"`);
console.log("  npm run setup:store");
