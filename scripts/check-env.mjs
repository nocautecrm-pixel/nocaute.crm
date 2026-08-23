/**
 * Checa variáveis do MVP. Carregue antes:
 *   node --env-file=.env.local scripts/check-env.mjs
 */
const groups = {
  "App (Vercel / local)": [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
    "TOKEN_ENCRYPTION_KEY",
    "COUPON_HMAC_SECRET",
    "WEBHOOK_VERIFY_TOKEN",
  ],
  Meta: [
    "NEXT_PUBLIC_META_APP_ID",
    "NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID",
    "META_APP_ID",
    "META_APP_SECRET",
  ],
  "Worker (Railway)": [
    "REDIS_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TOKEN_ENCRYPTION_KEY",
  ],
};

function status(key) {
  const value = process.env[key]?.trim();
  if (!value) return "falta";
  if (key === "TOKEN_ENCRYPTION_KEY" && value.length !== 64) return "64 hex?";
  return "ok";
}

let missing = 0;
for (const [title, keys] of Object.entries(groups)) {
  console.log(`-- ${title} --`);
  for (const key of keys) {
    const s = status(key);
    if (s === "falta") missing += 1;
    const mark = s === "ok" ? "+" : s === "falta" ? "-" : "?";
    console.log(`  [${mark}] ${key}`);
  }
  console.log("");
}

if (missing) {
  console.log(`${missing} variável(is) ainda vazia(s). Preencha .env.local ou painéis Vercel/Railway.`);
} else {
  console.log("Tudo preenchido para este checklist.");
}
