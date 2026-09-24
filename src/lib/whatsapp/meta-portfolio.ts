import { getGraphVersion } from "@/lib/config";

export type MetaPortfolioPhone = {
  id: string;
  displayPhone: string | null;
  verifiedName: string | null;
};

export type MetaPortfolioResult = {
  name: string | null;
  phones: MetaPortfolioPhone[];
  /** Sem permissão da Meta para listar Business/WABA — o lojista escolhe na mão. */
  limited: boolean;
};

type GraphErrorBody = {
  error?: { message?: string; code?: number };
};

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const version = getGraphVersion();
  const response = await fetch(`https://graph.facebook.com/${version}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as T & GraphErrorBody;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "Falha ao ler a conta Meta.");
  }
  return payload;
}

/**
 * Lê o perfil e tenta descobrir números WhatsApp já ligados ao Business do usuário.
 * Se faltar permissão (App Review), devolve `limited: true` sem quebrar o fluxo.
 */
export async function inspectMetaPortfolio(accessToken: string): Promise<MetaPortfolioResult> {
  let name: string | null = null;
  try {
    const me = await graphGet<{ name?: string }>("/me?fields=name", accessToken);
    name = me.name ?? null;
  } catch {
    // Continua — o nome é opcional.
  }

  try {
    const phones = await discoverWhatsAppPhones(accessToken);
    return { name, phones, limited: false };
  } catch {
    return { name, phones: [], limited: true };
  }
}

async function discoverWhatsAppPhones(accessToken: string): Promise<MetaPortfolioPhone[]> {
  const businesses = await graphGet<{ data?: Array<{ id: string }> }>(
    "/me/businesses?fields=id&limit=25",
    accessToken,
  );
  const businessIds = (businesses.data ?? []).map((row) => row.id);
  if (!businessIds.length) return [];

  const found: MetaPortfolioPhone[] = [];
  const seen = new Set<string>();

  for (const businessId of businessIds.slice(0, 5)) {
    for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
      const wabas = await graphGet<{ data?: Array<{ id: string }> }>(
        `/${businessId}/${edge}?fields=id&limit=10`,
        accessToken,
      );
      for (const waba of (wabas.data ?? []).slice(0, 5)) {
        const numbers = await graphGet<{
          data?: Array<{
            id: string;
            display_phone_number?: string;
            verified_name?: string;
          }>;
        }>(
          `/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=10`,
          accessToken,
        );
        for (const phone of numbers.data ?? []) {
          if (seen.has(phone.id)) continue;
          seen.add(phone.id);
          found.push({
            id: phone.id,
            displayPhone: phone.display_phone_number ?? null,
            verifiedName: phone.verified_name ?? null,
          });
        }
      }
    }
  }

  return found;
}
