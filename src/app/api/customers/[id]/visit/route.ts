import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { registerVisit } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const restaurantId = await getCurrentRestaurantId();
    const customer = await registerVisit(restaurantId, id);
    revalidatePath("/clientes");
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return jsonRouteError(error, "Não foi possível registrar a visita");
  }
}
