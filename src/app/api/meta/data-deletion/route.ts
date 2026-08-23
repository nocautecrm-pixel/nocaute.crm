import { NextRequest, NextResponse } from "next/server";
import { handleMetaDataDeletion } from "@/server/meta-callbacks";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = await handleMetaDataDeletion(request);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no data deletion callback";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
