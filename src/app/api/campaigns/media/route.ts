import { NextRequest, NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api-errors";
import { uploadRestaurantMedia } from "@/server/media";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const restaurantId = await getCurrentRestaurantId();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione um arquivo do computador." }, { status: 400 });
    }

    const uploaded = await uploadRestaurantMedia({
      restaurantId,
      file,
      kind: "creative",
    });

    return NextResponse.json({
      url: uploaded.url,
      path: uploaded.path,
      mediaType: uploaded.mediaType,
      fileName: uploaded.fileName,
      demo: uploaded.demo,
    });
  } catch (error) {
    return jsonRouteError(error, "Falha no upload");
  }
}
