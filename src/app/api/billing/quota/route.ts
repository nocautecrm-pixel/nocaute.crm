import { NextResponse } from "next/server";
import { getQuotaSnapshot } from "@/server/billing/quota-gateway";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function GET() {
  const restaurantId = await getCurrentRestaurantId();
  const quota = await getQuotaSnapshot(restaurantId);
  return NextResponse.json({ ok: true, quota });
}
