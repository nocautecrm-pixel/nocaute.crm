import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { saveStoreLogo } from "@/server/store";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await getCurrentRestaurantId();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma imagem de logo." }, { status: 400 });
    }

    const result = await saveStoreLogo(file);
    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Falha ao enviar o logo");
  }
}
