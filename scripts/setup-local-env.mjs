import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, ".env.example");
const localPath = join(root, ".env.local");

if (!existsSync(examplePath)) {
  console.error(".env.example não encontrado.");
  process.exit(1);
}

if (existsSync(localPath)) {
  console.log(".env.local já existe — não sobrescrevi. Apague manualmente se quiser regenerar.");
  process.exit(0);
}

const tokenKey = randomBytes(32).toString("hex");
const couponSecret = randomBytes(32).toString("hex");
const webhookToken = `nocaute-${randomBytes(16).toString("hex")}`;

let content = readFileSync(examplePath, "utf8");
content = content.replace(/^TOKEN_ENCRYPTION_KEY=.*$/m, `TOKEN_ENCRYPTION_KEY=${tokenKey}`);
content = content.replace(/^COUPON_HMAC_SECRET=.*$/m, `COUPON_HMAC_SECRET=${couponSecret}`);
content = content.replace(/^WEBHOOK_VERIFY_TOKEN=.*$/m, `WEBHOOK_VERIFY_TOKEN=${webhookToken}`);

writeFileSync(localPath, content, "utf8");

console.log("Criado .env.local com chaves geradas.");
console.log("");
console.log("Próximo: abra .env.local e preencha:");
console.log("  - NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE (Supabase → Settings → API)");
console.log("  - REDIS_URL (Railway Redis ou redis://127.0.0.1:6379 com npm run infra:redis)");
console.log("  - Bloco Meta (developers.facebook.com) quando for testar WhatsApp real");
console.log("");
console.log("WEBHOOK_VERIFY_TOKEN (use o mesmo na Meta e na Vercel):");
console.log(`  ${webhookToken}`);
