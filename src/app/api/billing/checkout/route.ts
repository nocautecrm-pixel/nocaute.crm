import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAsaasConfigured } from "@/lib/billing/asaas-config";
import { PLANS } from "@/lib/billing/plans";
import { BackendUnavailableError } from "@/lib/config";
import {
  AsaasApiError,
  AsaasNotConfiguredError,
  startPlanCheckout,
} from "@/server/billing/asaas-gateway";
import { AuthRequiredError, StoreRequiredError, getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

const bodySchema = z.object({
  planSlug: z.enum(["basico", "custom", "pro"]),
  billingType: z.enum(["CREDIT_CARD", "PIX"]),
  cpfCnpj: z.string().min(11).max(18),
});

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: isAsaasConfigured(),
    webhookPath: "/api/webhooks/asaas",
    plans: PLANS.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      includedLeads: p.includedLeads,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos. Informe planSlug, billingType e cpfCnpj." },
        { status: 400 },
      );
    }

    const restaurantId = await getCurrentRestaurantId();
    const result = await startPlanCheckout({
      restaurantId,
      planSlug: parsed.data.planSlug,
      billingType: parsed.data.billingType,
      cpfCnpj: parsed.data.cpfCnpj,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AsaasNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, code: error.code, configured: false },
        { status: 503 },
      );
    }
    if (error instanceof AsaasApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 502 },
      );
    }
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Faça login." }, { status: 401 });
    }
    if (error instanceof StoreRequiredError) {
      return NextResponse.json({ error: "Loja não provisionada." }, { status: 400 });
    }
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "Sistema indisponível." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Falha no checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
