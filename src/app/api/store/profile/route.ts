import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { storeProfileSchema } from "@/lib/validations";
import { saveStoreProfile } from "@/server/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = storeProfileSchema.parse(await request.json());
    const result = await saveStoreProfile(payload);
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Não foi possível salvar a loja");
  }
}
