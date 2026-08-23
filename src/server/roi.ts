import { BackendUnavailableError, isDemoMode, requireLiveBackend } from "@/lib/config";
import { demoRoi } from "@/lib/demo/seed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentRestaurantId } from "@/server/tenant";
import type { RoiSummary } from "@/types/database";

export async function getRoiSummary(restaurantId?: string): Promise<RoiSummary> {
  if (isDemoMode()) return demoRoi;

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const id = restaurantId ?? (await getCurrentRestaurantId());
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { count: queued },
    { count: sent },
    { count: delivered },
    { count: failed },
    { count: issued },
    { count: redeemed },
    { count: redeemed30d },
  ] = await Promise.all([
    admin.from("campaign_jobs").select("*", { count: "exact", head: true }).eq("restaurant_id", id).eq("status", "queued"),
    admin
      .from("campaign_jobs")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", id)
      .in("status", ["awaiting_confirm", "confirmed", "offer_sent", "delivered", "read"]),
    admin.from("campaign_jobs").select("*", { count: "exact", head: true }).eq("restaurant_id", id).in("status", ["delivered", "read"]),
    admin.from("campaign_jobs").select("*", { count: "exact", head: true }).eq("restaurant_id", id).eq("status", "failed"),
    admin.from("coupons").select("*", { count: "exact", head: true }).eq("restaurant_id", id),
    admin.from("coupons").select("*", { count: "exact", head: true }).eq("restaurant_id", id).eq("status", "redeemed"),
    admin
      .from("coupons")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", id)
      .eq("status", "redeemed")
      .gte("redeemed_at", since30d),
  ]);

  const couponsIssued = issued ?? 0;
  const couponsRedeemed = redeemed ?? 0;

  return {
    queued: queued ?? 0,
    sent: sent ?? 0,
    delivered: delivered ?? 0,
    failed: failed ?? 0,
    couponsIssued,
    couponsRedeemed: redeemed30d ?? couponsRedeemed,
    conversionRate: couponsIssued === 0 ? 0 : Math.round((couponsRedeemed / couponsIssued) * 100),
  };
}
