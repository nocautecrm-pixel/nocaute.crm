import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "@/lib/crypto";
import { MEDIA_BUCKET } from "@/server/media";

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

export async function eraseRestaurantPersonalData(
  admin: SupabaseClient,
  restaurantId: string,
) {
  const scoped = (table: string) => admin.from(table).delete().eq("restaurant_id", restaurantId);

  throwIfError((await scoped("message_events")).error);
  throwIfError((await scoped("campaign_jobs")).error);
  throwIfError((await scoped("coupons")).error);
  throwIfError((await scoped("customers")).error);
  throwIfError((await scoped("campaigns")).error);
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
