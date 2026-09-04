import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { upsertCustomerSchema } from "@/lib/validations";
import { getCustomerBoard } from "@/server/customer-board";
import { createCustomer, deleteAllCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Dados inválidos";
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function GET() {
  try {
    const restaurantId = await getCurrentRestaurantId();
    const board = await getCustomerBoard(restaurantId);
    return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao listar clientes") }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = upsertCustomerSchema.parse(await request.json());
    const restaurantId = await getCurrentRestaurantId();
    const customer = await createCustomer(restaurantId, body);
    revalidatePath("/clientes");
    return NextResponse.json({ ok: true, customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao criar cliente") }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const restaurantId = await getCurrentRestaurantId();
    const result = await deleteAllCustomers(restaurantId);
    const board = await getCustomerBoard(restaurantId);
    revalidatePath("/clientes");
    revalidatePath("/campanhas");
    revalidatePath("/visao-geral");
    return NextResponse.json({ ok: true, deleted: result.deleted, ...board });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao excluir a lista") }, { status: 400 });
  }
}
