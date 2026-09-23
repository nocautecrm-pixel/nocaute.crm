import { DEMO_RESTAURANT_ID, isDemoMode } from "@/lib/config";
import { decryptSecret } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppGraphJson, MetaGraphError } from "@/lib/whatsapp/graph-client";

export type MetaWabaBillingStatus = "not_linked" | "connected" | "missing" | "unknown";

export type MetaWabaBillingSnapshot = {
  status: MetaWabaBillingStatus;
  /** Moeda da WABA, se a Meta devolver. */
  currency: string | null;
  /** Mensagem curta para a UI (sem segredos). */
  detail: string;
};

type WabaBillingFields = {
  id?: string;
  primary_funding_id?: string | null;
  currency?: string | null;
  account_review_status?: string | null;
};

/**
 * Tech Provider: cartão/método de pagamento da WABA do lojista.
 * Heurística oficial: `primary_funding_id` preenchido ⇒ método ligado.
 */
export async function getMetaWabaBillingSnapshot(
  restaurantId: string,
): Promise<MetaWabaBillingSnapshot> {
  if (isDemoMode() || restaurantId === DEMO_RESTAURANT_ID) {
    return {
      status: "unknown",
      currency: null,
      detail: "Modo demonstração — status do cartão Meta não é consultado.",
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      status: "unknown",
      currency: null,
      detail: "Não foi possível consultar a Meta agora.",
    };
  }

  const { data: account } = await admin
    .from("whatsapp_accounts")
    .select("status, waba_id, access_token_encrypted")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!account || account.status !== "connected" || !account.waba_id) {
    return {
      status: "not_linked",
      currency: null,
      detail: "Conecte o WhatsApp da Meta antes de conferir o cartão das mensagens.",
    };
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(account.access_token_encrypted);
  } catch {
    return {
      status: "unknown",
      currency: null,
      detail: "Token da loja indisponível. Reconecte o WhatsApp da Meta.",
    };
  }

  if (!accessToken || accessToken === "REVOKED") {
    return {
      status: "not_linked",
      currency: null,
      detail: "WhatsApp desligado nesta loja. Conecte de novo em Configurações.",
    };
  }

  try {
    const waba = await getWhatsAppGraphJson<WabaBillingFields>({
      path: `/${account.waba_id}?fields=primary_funding_id,currency,account_review_status`,
      accessToken,
    });

    const fundingId = waba.primary_funding_id?.trim() || null;
    const currency = waba.currency?.trim() || null;

    if (fundingId) {
      return {
        status: "connected",
        currency,
        detail: currency
          ? `Método de pagamento da Meta ligado (moeda ${currency}).`
          : "Método de pagamento da Meta ligado nesta conta WhatsApp.",
      };
    }

    return {
      status: "missing",
      currency,
      detail:
        "A Meta ainda não tem cartão/método de pagamento nesta conta WhatsApp. Cadastre na Meta para poder enviar templates pagos.",
    };
  } catch (error) {
    const code = error instanceof MetaGraphError ? error.code : undefined;
    const message = error instanceof Error ? error.message : "Falha na consulta";
    return {
      status: "unknown",
      currency: null,
      detail:
        code === 190
          ? "Token da Meta expirado ou inválido. Reconecte o WhatsApp em Configurações."
          : `Não foi possível ler o pagamento na Meta (${message}). Use o atalho abaixo para conferir no painel oficial.`,
    };
  }
}
