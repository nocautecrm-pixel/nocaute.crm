import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthRequiredError, getCurrentRestaurantId } from "@/server/tenant";
import { inspectMetaPortfolio } from "@/lib/whatsapp/meta-portfolio";

export const runtime = "nodejs";

const bodySchema = z.object({
  accessToken: z.string().min(20).max(2048),
});

export async function POST(request: NextRequest) {
  try {
    await getCurrentRestaurantId();
    const body = bodySchema.parse(await request.json());
    const portfolio = await inspectMetaPortfolio(body.accessToken);
    return NextResponse.json({
      ok: true,
      name: portfolio.name,
      phones: portfolio.phones,
      limited: portfolio.limited,
      hasWhatsAppNumber: portfolio.phones.length > 0,
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Faça login no Nocaute." }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Não foi possível ler a conta Meta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
