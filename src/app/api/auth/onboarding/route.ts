import { NextRequest, NextResponse } from "next/server";
import { onboardingSchema } from "@/lib/validations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionRestaurantForOwner } from "@/server/restaurant-provision";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
    }

    const payload = onboardingSchema.parse(await request.json());

    const result = await provisionRestaurantForOwner({
      ownerUserId: user.id,
      name: payload.storeName,
      city: payload.city,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir o cadastro.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
