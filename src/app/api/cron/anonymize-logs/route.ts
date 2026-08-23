import { NextRequest, NextResponse } from "next/server";
import { anonymizeCampaignLogsOlderThan } from "@/server/compliance/retention";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(secret && header === `Bearer ${secret}`);
}

async function runAnonymize() {
  const result = await anonymizeCampaignLogsOlderThan();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return unauthorized();
  try {
    return await runAnonymize();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na anonimização";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) return unauthorized();
  try {
    return await runAnonymize();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na anonimização";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
