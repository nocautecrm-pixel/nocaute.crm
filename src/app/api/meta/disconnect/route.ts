import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { DEMO_WHATSAPP_COOKIE } from "@/lib/demo/store";
import { META_DISCONNECTED_LABEL } from "@/lib/whatsapp/constants";
import { disconnectWhatsAppAccount } from "@/server/whatsapp-account";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (isDemoMode()) {
      const response = NextResponse.json({
        ok: true,
        connected: false,
        label: META_DISCONNECTED_LABEL,
        demo: true,
      });
      response.cookies.set(DEMO_WHATSAPP_COOKIE, "", {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        maxAge: 0,
      });
      return response;
    }

    const restaurantId = await getCurrentRestaurantId();
    const result = await disconnectWhatsAppAccount(restaurantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao desconectar o WhatsApp";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
