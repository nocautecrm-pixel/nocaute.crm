import { NextRequest, NextResponse } from "next/server";
import { handleMetaDeauth } from "@/server/meta-callbacks";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await handleMetaDeauth(request);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no deauth callback";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
