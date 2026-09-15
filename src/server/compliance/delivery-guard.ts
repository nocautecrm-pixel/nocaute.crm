import { UnrecoverableError } from "bullmq";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DeliveryIdentity = {
  restaurantId: string;
  campaignId: string;
  campaignJobId: string;
  customerId: string;
};
export type DeliveryPhase = "initial" | "offer_media" | "offer_cta";
export class DeliveryPausedError extends Error {}
export class DeliverySuppressedError extends UnrecoverableError {}

export async function guardedDelivery(
  identity: DeliveryIdentity,
  phase: DeliveryPhase,
  send: (customer: { phone: string; name: string }) => Promise<{ wamid: string | null }>,
): Promise<string> {
  if (process.env.OUTBOUND_SENDS_PAUSED === "true") throw new DeliveryPausedError();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");
  const { data, error } = await admin.rpc("claim_delivery", {
    p_restaurant_id: identity.restaurantId, p_campaign_id: identity.campaignId,
    p_campaign_job_id: identity.campaignJobId, p_customer_id: identity.customerId, p_phase: phase,
  });
  if (error) throw error;
  if (data?.state === "paused") throw new DeliveryPausedError();
  if (data?.state === "suppressed") throw new DeliverySuppressedError("Cliente/campanha indisponível ou consentimento revogado.");
  if (data?.state === "accepted" && data.wamid) return String(data.wamid);
  if (data?.state !== "claimed") {
    throw new UnrecoverableError(`Envio bloqueado: ${data?.state ?? "unknown"}. Revise antes de reenviar.`);
  }
  try {
    const result = await send({ phone: String(data.phone), name: String(data.name) });
    if (!result.wamid) throw new Error("Provedor sem confirmação de envio.");
    const saved = await admin.from("delivery_attempts").update({
      state: "accepted", provider_message_id: result.wamid,
    }).eq("campaign_job_id", identity.campaignJobId).eq("restaurant_id", identity.restaurantId)
      .eq("phase", phase).eq("state", "started").select("campaign_job_id").single();
    if (saved.error || !saved.data) throw new Error("Confirmação de envio não persistida.");
    return result.wamid;
  } catch {
    // A lost acknowledgement may represent a delivered message. A unique
    // started/uncertain attempt is never automatically eligible again.
    await admin.from("delivery_attempts").update({ state: "uncertain" })
      .eq("campaign_job_id", identity.campaignJobId).eq("restaurant_id", identity.restaurantId)
      .eq("phase", phase).eq("state", "started");
    throw new UnrecoverableError("Envio retido para conciliação; não será repetido automaticamente.");
  }
}
