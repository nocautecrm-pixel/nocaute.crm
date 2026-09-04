import { normalizeCouponCode } from "@/lib/coupons/parse";
import { isDemoMode, requireLiveBackend } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redeemCouponSchema } from "@/lib/validations";

export async function redeemCoupon(
  rawCode: string,
  via: "inbound_whatsapp" | "manual_pos",
  restaurantId: string,
) {
  const { code } = redeemCouponSchema.parse({ code: normalizeCouponCode(rawCode) });

  if (isDemoMode()) {
    return {
      demo: true as const,
      code,
      status: "redeemed" as const,
      message: "Em demonstração o cupom é aceito sem gravar no banco.",
    };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data: coupon, error } = await admin
    .from("coupons")
    .select("id, status, customer_id, restaurant_id")
    .eq("code", code)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) throw error;
  if (!coupon) return { ok: false as const, reason: "not_found" as const };
  if (coupon.status === "redeemed") return { ok: false as const, reason: "already_redeemed" as const };
  if (coupon.status === "expired") return { ok: false as const, reason: "expired" as const };

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("coupons")
    .update({
      status: "redeemed",
      redeemed_at: now,
      redeemed_via: via,
    })
    .eq("id", coupon.id)
    .eq("restaurant_id", restaurantId)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) return { ok: false as const, reason: "already_redeemed" as const };

  if (coupon.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("order_count")
      .eq("id", coupon.customer_id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (customer) {
      await admin
        .from("customers")
        .update({
          last_purchase_at: now,
          order_count: (Number(customer.order_count) || 0) + 1,
        })
        .eq("id", coupon.customer_id)
        .eq("restaurant_id", restaurantId);
    }
  }

  return { ok: true as const, code };
}
