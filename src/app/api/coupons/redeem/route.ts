import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { redeemCoupon } from "@/server/conversions";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: string };
    const restaurantId = await getCurrentRestaurantId();
    await consumeRateLimit(`coupon-redeem:${restaurantId}`, 30, 60_000);
    const result = await redeemCoupon(body.code ?? "", "manual_pos", restaurantId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Cupom inválido");
  }
}
