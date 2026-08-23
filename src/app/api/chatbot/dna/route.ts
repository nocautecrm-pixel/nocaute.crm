import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { brandDnaSchema } from "@/lib/validations";
import { getBrandDna, saveBrandDna } from "@/server/chatbot";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dna = await getBrandDna();
    return NextResponse.json({ ok: true, dna });
  } catch (error) {
    return jsonRouteError(error, "Não foi possível carregar o DNA");
  }
}

export async function POST(request: NextRequest) {
  try {
    const dna = brandDnaSchema.parse(await request.json());
    const result = await saveBrandDna(dna);
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Não foi possível salvar o DNA");
  }
}
