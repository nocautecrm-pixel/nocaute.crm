import { BackendUnavailableError } from "@/lib/config";
import { MARKETING_COOLDOWN_MS } from "@/lib/whatsapp/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = [
  "sending",
  "awaiting_confirm",
  "confirmed",
  "offer_sent",
  "sent",
  "delivered",
  "read",
] as const;

export async function findCustomersInMarketingCooldown(
  restaurantId: string,
  customerIds: string[],
) {
  if (!customerIds.length) return new Set<string>();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const since = new Date(Date.now() - MARKETING_COOLDOWN_MS).toISOString();
  const { data, error } = await admin
    .from("campaign_jobs")
    .select("customer_id")
    .eq("restaurant_id", restaurantId)
    .in("customer_id", customerIds)
    .gte("sent_at", since)
    .in("status", [...ACTIVE_STATUSES]);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.customer_id as string));
}
