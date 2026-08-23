import { NextRequest, NextResponse } from "next/server";
import { QuotaExceededError } from "@/lib/billing/plans";
import { BackendUnavailableError } from "@/lib/config";
import { createCampaign } from "@/server/campaigns";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurantId = await getCurrentRestaurantId();
    const result = await createCampaign(restaurantId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          remaining: error.remaining,
          needed: error.needed,
          included: error.included,
          planName: error.planName,
        },
        { status: 403 },
      );
    }
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "Sistema indisponível." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Falha ao criar campanha";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
