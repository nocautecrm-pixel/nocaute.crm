import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { upsertCustomerSchema } from "@/lib/validations";
import { deleteCustomer, updateCustomer } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Dados inválidos";
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = upsertCustomerSchema.parse(await request.json());
    const restaurantId = await getCurrentRestaurantId();
    const customer = await updateCustomer(restaurantId, id, body);
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao atualizar cliente") }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const restaurantId = await getCurrentRestaurantId();
    await deleteCustomer(restaurantId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao excluir cliente") }, { status: 400 });
  }
}
