import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, isMetaConfigured, isRedisConfigured } from "@/lib/config";
import { getWebhookIngestQueue } from "@/lib/queue/queues";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { ingestWhatsAppPayload } from "@/server/webhooks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET;

  if (!isDemoMode()) {
    if (!appSecret) {
      return NextResponse.json({ error: "META_APP_SECRET ausente." }, { status: 401 });
    }
    const valid = verifyMetaSignature(rawBody, signature, appSecret);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    if (isRedisConfigured()) {
      const eventId =
        request.headers.get("x-hub-signature-256") ?? `evt-${Date.now()}`;
      await getWebhookIngestQueue().add("ingest", {
        providerEventId: eventId,
        rawBody,
      });
    } else {
      await ingestWhatsAppPayload(rawBody);
    }
  } catch (error) {
    console.error("Webhook ingest error", error);
    return NextResponse.json({ error: "Falha ao processar webhook" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
