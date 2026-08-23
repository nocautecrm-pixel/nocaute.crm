import { BackendUnavailableError } from "@/lib/config";
import { decryptSecret } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertAppSubscribed,
  assertTemplateApproved,
} from "@/lib/whatsapp/embedded-signup";

export async function assertWhatsAppReadyForCampaign(
  restaurantId: string,
  templateName: string,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const { data: account, error } = await admin
    .from("whatsapp_accounts")
    .select("status, waba_id, access_token_encrypted")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) throw error;
  if (!account || account.status !== "connected" || !account.waba_id) {
    throw new Error("Conecte o WhatsApp da loja em Configurações antes de disparar.");
  }

  const token = decryptSecret(account.access_token_encrypted as string);
  await assertAppSubscribed(account.waba_id as string, token);
  await assertTemplateApproved(account.waba_id as string, token, templateName);
}
