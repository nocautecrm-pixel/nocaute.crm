import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { DEMO_RESTAURANT_ID } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  META_CONNECTED_LABEL,
  META_DISCONNECTED_LABEL,
} from "@/lib/whatsapp/constants";
import {
  exchangeEmbeddedSignupCode,
  resolveWhatsAppAssets,
} from "@/lib/whatsapp/embedded-signup";
import type { WhatsAppCredentials } from "@/lib/whatsapp/service";

export { META_CONNECTED_LABEL, META_DISCONNECTED_LABEL };

export async function completeEmbeddedSignup(input: {
  restaurantId: string;
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}) {
  if (!input.restaurantId || input.restaurantId === DEMO_RESTAURANT_ID) {
    throw new Error("Loja não identificada. Configure o Supabase e entre com a conta do lojista.");
  }

  const accessToken = await exchangeEmbeddedSignupCode(input.code);
  const assets = await resolveWhatsAppAssets(accessToken, {
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin indisponível para persistir a conta WhatsApp.");
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("whatsapp_accounts").upsert(
    {
      restaurant_id: input.restaurantId,
      waba_id: assets.wabaId,
      phone_number_id: assets.phoneNumberId,
      display_phone: assets.displayPhone,
      verified_name: assets.verifiedName,
      meta_user_id: assets.metaUserId,
      access_token_encrypted: encryptSecret(accessToken),
      status: "connected",
      quality_rating: assets.qualityRating,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) throw error;

  return {
    ok: true as const,
    connected: true as const,
    displayPhone: assets.displayPhone,
    verifiedName: assets.verifiedName,
    qualityRating: assets.qualityRating,
    wabaId: assets.wabaId,
    phoneNumberId: assets.phoneNumberId,
    label: META_CONNECTED_LABEL,
  };
}

/** Derruba a ligação no Nocaute: token inválido, status disconnected. Não apaga o WhatsApp do telemóvel. */
export async function disconnectWhatsAppAccount(restaurantId: string) {
  if (!restaurantId || restaurantId === DEMO_RESTAURANT_ID) {
    throw new Error("Loja não identificada.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin indisponível para desconectar o WhatsApp.");
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("whatsapp_accounts")
    .update({
      status: "disconnected",
      access_token_encrypted: encryptSecret("REVOKED"),
      display_phone: null,
      verified_name: null,
      quality_rating: null,
      meta_user_id: null,
      last_inbound_at: null,
      updated_at: now,
    })
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Nenhuma conta WhatsApp ligada a esta loja.");
  }

  return {
    ok: true as const,
    connected: false as const,
    label: META_DISCONNECTED_LABEL,
  };
}

export async function getConnectedWhatsAppAccount(
  restaurantId: string,
): Promise<WhatsAppCredentials> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data: account } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token_encrypted, status")
    .eq("restaurant_id", restaurantId)
    .single();

  if (!account || account.status !== "connected") {
    throw new Error("WhatsApp da casa não está conectado");
  }

  return {
    phoneNumberId: account.phone_number_id,
    accessToken: decryptSecret(account.access_token_encrypted),
  };
}

export async function findRestaurantByPhoneNumberId(phoneNumberId?: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  if (phoneNumberId) {
    const { data } = await admin
      .from("whatsapp_accounts")
      .select("restaurant_id, status")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (data?.status === "connected") return data.restaurant_id as string;
  }

  return null;
}

export async function touchLastInbound(restaurantId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("whatsapp_accounts")
    .update({ last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId);
}
