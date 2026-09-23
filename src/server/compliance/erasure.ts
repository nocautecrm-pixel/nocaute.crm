import type { SupabaseClient } from "@supabase/supabase-js";
import type { Queue } from "bullmq";
import { encryptSecret } from "@/lib/crypto";
import { isRedisConfigured } from "@/lib/config";
import {
  getCampaignOfferQueue,
  getCampaignSendQueue,
} from "@/lib/queue/queues";
import { MEDIA_BUCKET } from "@/server/media";

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

/**
 * Apaga a base de clientes da loja e todo rastro operacional ligado a ela
 * (eventos, jobs, cupons, campanhas). Não mexe em WhatsApp, DNA nem mídia.
 */
export async function eraseRestaurantCustomerBase(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ deletedCustomers: number }> {
  const scoped = (table: string) => admin.from(table).delete().eq("restaurant_id", restaurantId);

  throwIfError((await scoped("message_events")).error);
  throwIfError((await scoped("campaign_jobs")).error);
  throwIfError((await scoped("coupons")).error);

  const { data: customers, error: customersError } = await admin
    .from("customers")
    .delete()
    .eq("restaurant_id", restaurantId)
    .select("id");
  throwIfError(customersError);

  throwIfError((await scoped("campaigns")).error);

  await purgeRestaurantCampaignQueues(restaurantId);

  return { deletedCustomers: (customers ?? []).length };
}

/** Remove jobs BullMQ pendentes/ativos com PII da loja. */
export async function purgeRestaurantCampaignQueues(restaurantId: string) {
  if (!isRedisConfigured()) return;

  await Promise.all([
    removeJobsForRestaurant(getCampaignSendQueue(), restaurantId),
    removeJobsForRestaurant(getCampaignOfferQueue(), restaurantId),
  ]);
}

async function removeJobsForRestaurant(queue: Queue, restaurantId: string) {
  const jobs = await queue.getJobs(
    ["waiting", "delayed", "active", "prioritized", "waiting-children"],
    0,
    5_000,
  );
  for (const job of jobs) {
    const data = job.data as { restaurantId?: string } | null;
    if (data?.restaurantId !== restaurantId) continue;
    try {
      await job.remove();
    } catch {
      // Job ativo pode recusar remoção; o worker falha depois sem customer no DB.
    }
  }
}

export async function eraseRestaurantPersonalData(
  admin: SupabaseClient,
  restaurantId: string,
) {
  await eraseRestaurantCustomerBase(admin, restaurantId);

  const scoped = (table: string) => admin.from(table).delete().eq("restaurant_id", restaurantId);
  throwIfError((await scoped("audiences")).error);
  throwIfError((await scoped("chatbot_profiles")).error);

  const { error: whatsappError } = await admin
    .from("whatsapp_accounts")
    .update({
      status: "disconnected",
      access_token_encrypted: encryptSecret("REVOKED"),
      display_phone: null,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId);
  throwIfError(whatsappError);

  const { error: logoError } = await admin
    .from("restaurants")
    .update({ logo_url: null })
    .eq("id", restaurantId);
  throwIfError(logoError);

  await removeRestaurantMedia(admin, restaurantId);
}

async function removeRestaurantMedia(admin: SupabaseClient, restaurantId: string) {
  const folders = [`${restaurantId}/criativos`, `${restaurantId}/logo`];
  for (const folder of folders) {
    for (;;) {
      const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(folder, { limit: 100 });
      throwIfError(error);
      const paths = (data ?? [])
        .map((object) => object.name)
        .filter(Boolean)
        .map((name) => `${folder}/${name}`);
      if (!paths.length) break;
      const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove(paths);
      throwIfError(removeError);
    }
  }
}
