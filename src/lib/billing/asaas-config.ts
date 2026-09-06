/** Config Asaas — só server. Nunca NEXT_PUBLIC_ nas keys. */

export type AsaasEnv = "sandbox" | "production";

export type AsaasBillingType = "CREDIT_CARD" | "PIX";

export function getAsaasEnv(): AsaasEnv {
  const raw = process.env.ASAAS_ENV?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function getAsaasBaseUrl() {
  return getAsaasEnv() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

export function getAsaasApiKey() {
  return process.env.ASAAS_API_KEY?.trim() || "";
}

export function getAsaasWebhookToken() {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() || "";
}

/** Pronto para cobrar: API key + token de webhook distintos. */
export function isAsaasConfigured() {
  const key = getAsaasApiKey();
  const token = getAsaasWebhookToken();
  return Boolean(key && token && key !== token);
}

export function asaasWebhookUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/asaas`;
}
