import { NextRequest, NextResponse } from "next/server";
import { parseCustomerCsv } from "@/lib/customers/csv";
import { importCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo CSV." }, { status: 400 });
    }
    if (file.size > 1_000_000) {
      return NextResponse.json({ error: "Arquivo acima de 1 MB." }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCustomerCsv(text);
    const restaurantId = await getCurrentRestaurantId();
    const result = await importCustomers(restaurantId, parsed.rows);
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      duplicates: result.duplicates,
      invalid: parsed.invalid + result.invalid,
      rejected: parsed.rejected.slice(0, 8),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar clientes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
