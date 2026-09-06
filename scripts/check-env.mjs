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
    "META_EMBEDDED_SIGNUP_CONFIG_ID",
  ],
  "Worker (Railway)": [
    "REDIS_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TOKEN_ENCRYPTION_KEY",
  ],
  "Asaas (opcional · mensalidade)": [
    "ASAAS_ENV",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
  ],
  "Import agent IA (opcional · PDF scan / foto)": [
    "OPENAI_API_KEY",
  ],
};

/** Grupos que não entram no contador de “faltando” (ainda opcional no MVP). */
const optionalGroups = new Set([
  "Asaas (opcional · mensalidade)",
  "Import agent IA (opcional · PDF scan / foto)",
]);

function status(key) {
  const value = process.env[key]?.trim();
  if (!value) return "falta";
  if (key === "TOKEN_ENCRYPTION_KEY" && value.length !== 64) return "64 hex?";
  return "ok";
}

let missing = 0;
for (const [title, keys] of Object.entries(groups)) {
  const optional = optionalGroups.has(title);
  console.log(`-- ${title} --`);
  for (const key of keys) {
    const s = status(key);
    if (s === "falta" && !optional) missing += 1;
    const mark = s === "ok" ? "+" : s === "falta" ? (optional ? "o" : "-") : "?";
    console.log(`  [${mark}] ${key}`);
  }
  console.log("");
}

if (missing) {
  console.log(`${missing} variável(is) ainda vazia(s). Preencha .env.local ou painéis Vercel/Railway.`);
} else {
  console.log("Tudo preenchido para este checklist.");
}
