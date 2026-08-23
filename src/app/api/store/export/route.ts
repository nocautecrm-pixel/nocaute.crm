import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { isDemoMode } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: "Exportação só existe com o banco no ar." }, { status: 400 });
    }
    const restaurantId = await getCurrentRestaurantId();
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase admin indisponível.");

    const [customers, campaigns, coupons] = await Promise.all([
      admin.from("customers").select("name, phone, last_purchase_at, opt_in, opt_in_at, opt_in_source").eq("restaurant_id", restaurantId),
      admin.from("campaigns").select("name, segment, status, created_at").eq("restaurant_id", restaurantId),
      admin.from("coupons").select("code, status, redeemed_at, redeemed_via").eq("restaurant_id", restaurantId),
    ]);

    return NextResponse.json({
      ok: true,
      exportedAt: new Date().toISOString(),
      restaurantId,
      customers: customers.data ?? [],
      campaigns: campaigns.data ?? [],
      coupons: coupons.data ?? [],
    });
  } catch (error) {
    return jsonRouteError(error, "Não foi possível exportar os dados");
  }
}
