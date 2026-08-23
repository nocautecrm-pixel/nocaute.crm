import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

console.log("Rode no Supabase → SQL Editor, nesta ordem (copie cada arquivo):\n");
console.log("  OU cole de uma vez: supabase/bootstrap-all.sql (npm run setup:bootstrap-sql)\n");
for (const file of files) {
  console.log(`  supabase/migrations/${file}`);
}
console.log("\nDepois: crie usuário em Authentication → Users e rode:");
console.log("  node --env-file=.env.local scripts/bootstrap-restaurant.mjs");
console.log("  (com BOOTSTRAP_OWNER_USER_ID=uuid-do-usuario)");
