import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { getDataDeletionStatus } from "@/server/meta-callbacks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Código ausente." }, { status: 400 });
    }

    const status = await getDataDeletionStatus(code);
    return NextResponse.json(status);
  } catch (error) {
    return jsonRouteError(error, "Não foi possível consultar a exclusão.");
  }
}
