import { NextRequest, NextResponse } from "next/server";
import { isDemoMode, isMetaOAuthConfigured } from "@/lib/config";
import { DEMO_WHATSAPP_COOKIE } from "@/lib/demo/store";
import { embeddedSignupSchema } from "@/lib/validations";
import {
  completeEmbeddedSignup,
  META_CONNECTED_LABEL,
} from "@/server/whatsapp-account";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

const DEMO_ACCOUNT = {
  ok: true as const,
  demo: true as const,
  connected: true as const,
  displayPhone: "+55 11 98888-1010",
  verifiedName: "Saladeria com Limão e Sal",
  qualityRating: "GREEN",
  wabaId: "WABA-DEMO",
  phoneNumberId: "PHONE-DEMO",
  label: META_CONNECTED_LABEL,
  message: "WhatsApp da loja linkado. Os dados abaixo vieram da Meta.",
};

function demoAccountResponse() {
  const response = NextResponse.json(DEMO_ACCOUNT);
  response.cookies.set(DEMO_WHATSAPP_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = embeddedSignupSchema.parse(await request.json());
    const metaReady = isMetaOAuthConfigured();

    if (body.code === "demo") {
      if (!isDemoMode()) {
        return NextResponse.json(
          { error: "Demonstração desligada. Configure a Meta (Embedded Signup) para conectar o WhatsApp." },
          { status: 400 },
        );
      }
      return demoAccountResponse();
    }

    if (!metaReady) {
      return NextResponse.json(
        { error: "META_APP_ID / META_APP_SECRET ausentes no servidor." },
        { status: 400 },
      );
    }

    const account = await completeEmbeddedSignup({
      restaurantId: await getCurrentRestaurantId(),
      ...body,
    });
    return NextResponse.json(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no Embedded Signup";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
