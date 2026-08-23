import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function provisionRestaurantForOwner(input: {
  ownerUserId: string;
  name: string;
  city: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin não configurado.");
  }

  const { data: existing } = await admin
    .from("restaurants")
    .select("id, name")
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();

  if (existing?.id) {
    const { error: quotaError } = await admin.rpc("ensure_quota_account", {
      p_restaurant_id: existing.id,
    });
    if (quotaError) throw new Error(quotaError.message);
    return { restaurantId: existing.id as string, created: false as const };
  }

  const { data: created, error: insertError } = await admin
    .from("restaurants")
    .insert({
      name: input.name,
      city: input.city,
      owner_user_id: input.ownerUserId,
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    throw new Error(insertError?.message ?? "Não foi possível criar a loja.");
  }

  const { error: quotaError } = await admin.rpc("ensure_quota_account", {
    p_restaurant_id: created.id,
  });
  if (quotaError) throw new Error(quotaError.message);

  return { restaurantId: created.id as string, created: true as const };
}

export function storeDraftFromUserMetadata(metadata: Record<string, unknown> | undefined) {
  const storeName =
    typeof metadata?.store_name === "string" ? metadata.store_name.trim() : "";
  const city = typeof metadata?.city === "string" ? metadata.city.trim() : "";
  return { storeName, city };
}

export async function provisionRestaurantFromAuthUser(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}) {
  const draft = storeDraftFromUserMetadata(user.user_metadata);
  if (draft.storeName.length < 2 || draft.city.length < 2) {
    return null;
  }

  return provisionRestaurantForOwner({
    ownerUserId: user.id,
    name: draft.storeName,
    city: draft.city,
  });
}
