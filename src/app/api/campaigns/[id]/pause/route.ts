import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { setCampaignStatus } from "@/server/campaigns";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await setCampaignStatus(id, "paused");
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Falha ao pausar");
  }
}
