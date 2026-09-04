import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAudienceSchema } from "@/lib/validations";
import { createAudience, listAudiences } from "@/server/audiences";

export const runtime = "nodejs";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Dados inválidos";
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function GET() {
  try {
    const audiences = await listAudiences();
    return NextResponse.json({ audiences });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao listar públicos") }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createAudienceSchema.parse(await request.json());
    const audience = await createAudience(body);
    return NextResponse.json({ ok: true, audience }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Falha ao criar público") }, { status: 400 });
  }
}
