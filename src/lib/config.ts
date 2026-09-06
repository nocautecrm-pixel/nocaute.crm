export const DEMO_RESTAURANT_ID = "demo-restaurant";

export class BackendUnavailableError extends Error {
  constructor(message = "BACKEND_UNAVAILABLE") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

/** Demo só no dev local, com ALLOW_DEMO=true. Produção ignora a flag. */
export function isDemoAllowed() {
  if (isProductionRuntime()) return false;
  return process.env.ALLOW_DEMO === "true";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isLiveBackendReady() {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

/** Cookie/KPI fake: só quando o demo foi pedido e o backend real não está no ar. */
export function isDemoMode() {
  return isDemoAllowed() && !isLiveBackendReady();
}

export function missingLiveBackendEnv() {
  return (
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ] as const
  ).filter((key) => !process.env[key]?.trim());
}

export function requireLiveBackend() {
  if (isDemoMode()) return;
  if (!isLiveBackendReady()) {
    throw new BackendUnavailableError();
  }
}

export function isMetaOAuthConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function isMetaConfigured() {
  return Boolean(isMetaOAuthConfigured() && process.env.WEBHOOK_VERIFY_TOKEN);
}

/** Login Embedded Signup no browser + OAuth + webhook no servidor. */
export function isEmbeddedSignupConfigured() {
  return Boolean(
    isMetaConfigured() &&
      process.env.NEXT_PUBLIC_META_APP_ID &&
      process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID,
  );
}

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

/** Mensalidade Asaas (cartão/Pix). Opcional até preencher ASAAS_* no env. */
export function isAsaasConfigured() {
  const key = process.env.ASAAS_API_KEY?.trim();
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  return Boolean(key && token && key !== token);
}

export function getGraphVersion() {
  return process.env.META_GRAPH_VERSION ?? "v21.0";
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

export function getSendRateLimit() {
  return {
    max: Number(process.env.WHATSAPP_MAX_MSGS_PER_WINDOW ?? 1),
    duration: Number(process.env.WHATSAPP_WINDOW_MS ?? 2500),
  };
}

/** Variáveis que o worker no Railway precisa para disparar de verdade. */
export const WORKER_REQUIRED_ENV = [
  "REDIS_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export function missingWorkerEnv() {
  return WORKER_REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
}
