import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { clearStoreProfile } from "@/server/store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await clearStoreProfile();
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Não foi possível desligar o perfil da loja");
  }
}
