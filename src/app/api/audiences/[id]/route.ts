import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateAudienceSchema } from "@/lib/validations";
import { deleteAudience, updateAudience } from "@/server/audiences";

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
    const body = updateAudienceSchema.parse(await request.json());
    const audience = await updateAudience(id, body);
    return NextResponse.json({ ok: true, audience });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao atualizar público") }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteAudience(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao excluir público") }, { status: 400 });
  }
}
