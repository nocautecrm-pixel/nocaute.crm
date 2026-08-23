import { getGraphVersion } from "@/lib/config";
import { MetaGraphError } from "@/lib/whatsapp/graph-client";

type GraphErrorBody = {
  error?: { code?: number; message?: string; error_user_msg?: string };
};

export type WhatsAppCloudAssets = {
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  metaUserId: string | null;
};

type PhoneNode = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

function graphBase() {
  return `https://graph.facebook.com/${getGraphVersion()}`;
}

function appCredentials() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET ausentes.");
  }
  return { appId, appSecret };
}

async function parseGraph<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & GraphErrorBody;
  if (!response.ok || payload.error) {
    throw new MetaGraphError(
      payload.error?.error_user_msg ?? payload.error?.message ?? "Falha na Graph API",
      payload.error?.code,
    );
  }
  return payload;
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${graphBase()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseGraph<T>(response);
}

async function graphPost<T>(path: string, accessToken: string, body?: unknown): Promise<T> {
  const response = await fetch(`${graphBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return parseGraph<T>(response);
}

/**
 * Troca o `code` do FB.login (Embedded Signup) por um token de longa duração.
 * Tokens de System User do fluxo oficial costumam já ser permanentes;
 * a troca fb_exchange_token cobre o caso de user token de 60 dias.
 */
export async function exchangeEmbeddedSignupCode(code: string) {
  const { appId, appSecret } = appCredentials();
  const url = new URL(`${graphBase()}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const payload = await parseGraph<{ access_token?: string }>(await fetch(url, { cache: "no-store" }));
  if (!payload.access_token) {
    throw new Error("A Meta não devolveu o access token.");
  }

  return exchangeForLongLivedToken(payload.access_token);
}

async function exchangeForLongLivedToken(token: string) {
  const { appId, appSecret } = appCredentials();
  try {
    const url = new URL(`${graphBase()}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", token);

    const payload = await parseGraph<{ access_token?: string }>(
      await fetch(url, { cache: "no-store" }),
    );
    return payload.access_token ?? token;
  } catch {
    return token;
  }
}

async function fetchMetaUserId(accessToken: string) {
  try {
    const payload = await graphGet<{ id?: string }>("/me?fields=id", accessToken);
    return payload.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveWhatsAppAssets(
  accessToken: string,
  hints: { wabaId?: string; phoneNumberId?: string } = {},
): Promise<WhatsAppCloudAssets> {
  const wabaId = await resolveWabaId(accessToken, hints.wabaId);
  const phones = await listWabaPhoneNumbers(wabaId, accessToken);
  const selected = phones.find((phone) => phone.id === hints.phoneNumberId) ?? phones[0];

  if (!selected?.id) {
    throw new Error("A WABA autorizada não possui número de telefone.");
  }

  await subscribeAppToWaba(wabaId, accessToken);
  await assertAppSubscribed(wabaId, accessToken);

  return {
    wabaId,
    phoneNumberId: selected.id,
    displayPhone: selected.display_phone_number ?? null,
    verifiedName: selected.verified_name ?? null,
    qualityRating: selected.quality_rating ?? null,
    metaUserId: await fetchMetaUserId(accessToken),
  };
}

async function resolveWabaId(accessToken: string, hintedWabaId?: string) {
  if (hintedWabaId) {
    try {
      const phones = await listWabaPhoneNumbers(hintedWabaId, accessToken);
      if (phones.length) return hintedWabaId;
    } catch {
      // session_info pode chegar atrasado ou incompleto — descobre no servidor.
    }
  }

  const discovered = await discoverWabaId(accessToken);
  if (!discovered) {
    throw new Error("Não foi possível identificar a WABA autorizada.");
  }
  return discovered;
}

async function discoverWabaId(accessToken: string) {
  const fromDebug = await wabaIdsFromDebugToken(accessToken);
  if (fromDebug[0]) return fromDebug[0];

  const businessIds = await listBusinessIds(accessToken);
  for (const businessId of businessIds) {
    const owned = await listWabaIds(businessId, "owned_whatsapp_business_accounts", accessToken);
    if (owned[0]) return owned[0];
    const shared = await listWabaIds(businessId, "client_whatsapp_business_accounts", accessToken);
    if (shared[0]) return shared[0];
  }

  return null;
}

async function wabaIdsFromDebugToken(accessToken: string) {
  const { appId, appSecret } = appCredentials();
  const url = new URL(`${graphBase()}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const payload = await parseGraph<{
    data?: {
      is_valid?: boolean;
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
  }>(await fetch(url, { cache: "no-store" }));

  if (payload.data?.is_valid === false) {
    throw new Error("O token devolvido pela Meta é inválido.");
  }

  const ids = new Set<string>();
  for (const scope of payload.data?.granular_scopes ?? []) {
    if (!scope.scope.includes("whatsapp_business")) continue;
    for (const id of scope.target_ids ?? []) ids.add(id);
  }
  return [...ids];
}

async function listBusinessIds(accessToken: string) {
  const payload = await graphGet<{ data?: Array<{ id: string }> }>("/me/businesses", accessToken);
  return (payload.data ?? []).map((business) => business.id);
}

async function listWabaIds(businessId: string, edge: string, accessToken: string) {
  const payload = await graphGet<{ data?: Array<{ id: string }> }>(
    `/${businessId}/${edge}`,
    accessToken,
  );
  return (payload.data ?? []).map((account) => account.id);
}

async function listWabaPhoneNumbers(wabaId: string, accessToken: string) {
  const payload = await graphGet<{ data?: PhoneNode[] }>(
    `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken,
  );
  return payload.data ?? [];
}

async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  await graphPost(`/${wabaId}/subscribed_apps`, accessToken);
}

function subscribedAppIds(rows: Array<Record<string, { id?: string } | undefined>>) {
  const ids: string[] = [];
  for (const row of rows) {
    const id =
      row.whatsapp_business_api_data?.id ?? row.whatsapp_business_api_data?.id ?? undefined;
    if (id) ids.push(id);
  }
  return ids;
}

export async function assertAppSubscribed(wabaId: string, accessToken: string) {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID ausente.");

  const payload = await graphGet<{
    data?: Array<Record<string, { id?: string } | undefined>>;
  }>(`/${wabaId}/subscribed_apps`, accessToken);

  if (!subscribedAppIds(payload.data ?? []).includes(appId)) {
    throw new Error(
      "A WABA não inscreveu este app no webhook (subscribed_apps). Sem isso a mensagem pode sair e a resposta do cliente não chega.",
    );
  }
}

export async function listWabaTemplates(wabaId: string, accessToken: string) {
  const payload = await graphGet<{
    data?: Array<{ name: string; status: string; language: string }>;
  }>(`/${wabaId}/message_templates?fields=name,status,language&limit=250`, accessToken);
  return payload.data ?? [];
}

export async function assertTemplateApproved(
  wabaId: string,
  accessToken: string,
  templateName: string,
) {
  const templates = await listWabaTemplates(wabaId, accessToken);
  const match = templates.find((template) => template.name === templateName);
  if (!match) {
    throw new Error(
      `Template "${templateName}" não existe nesta WABA. Crie-o pelo JSON em public/templates/ e espere a Meta aprovar (APPROVED).`,
    );
  }
  if (match.status !== "APPROVED") {
    throw new Error(
      `Template "${templateName}" está ${match.status}. Campanha só dispara com status APPROVED.`,
    );
  }
}
