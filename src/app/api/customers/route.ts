import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { upsertCustomerSchema } from "@/lib/validations";
import { createCustomer } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Dados inválidos";
  if (error instanceof Error) return error.message;
  return "Falha ao criar cliente";
}

export async function POST(request: NextRequest) {
  try {
    const body = upsertCustomerSchema.parse(await request.json());
    const restaurantId = await getCurrentRestaurantId();
    const customer = await createCustomer(restaurantId, body);
    return NextResponse.json({ ok: true, customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
