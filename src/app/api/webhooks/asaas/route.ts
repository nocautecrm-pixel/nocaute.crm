import { NextRequest, NextResponse } from "next/server";
import { isAsaasConfigured } from "@/lib/billing/asaas-config";
import {
  AsaasNotConfiguredError,
  handleAsaasWebhook,
  verifyAsaasWebhookToken,
} from "@/server/billing/asaas-gateway";

export const runtime = "nodejs";

/**
 * Webhook Asaas.
 * No painel: URL = {NEXT_PUBLIC_APP_URL}/api/webhooks/asaas
 * Auth token = ASAAS_WEBHOOK_TOKEN (header asaas-access-token)
 * Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, …
 */
export async function POST(request: NextRequest) {
  if (!isAsaasConfigured()) {
    return NextResponse.json(
      { error: "Asaas não configurado neste ambiente." },
      { status: 503 },
    );
  }

  const token = request.headers.get("asaas-access-token");
  if (!verifyAsaasWebhookToken(token)) {
    return NextResponse.json({ error: "Token de webhook inválido." }, { status: 401 });
  }

  const rawBody = await request.text();

  try {
    const result = await handleAsaasWebhook(rawBody);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AsaasNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Asaas webhook error", error);
    return NextResponse.json({ error: "Falha ao processar webhook" }, { status: 500 });
  }
}
