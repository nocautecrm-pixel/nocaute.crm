import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { parseCustomerImportFile } from "@/lib/customers/import-file";
import { getCustomerBoard } from "@/server/customer-board";
import { importCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";

const MAX_BYTES = 5_000_000;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie uma planilha ou arquivo de texto." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 5 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseCustomerImportFile({
      filename: file.name,
      mime: file.type,
      bytes,
    });
    const restaurantId = await getCurrentRestaurantId();
    const result = await importCustomers(restaurantId, parsed.rows);
    const board = await getCustomerBoard(restaurantId);
    revalidatePath("/clientes");
    revalidatePath("/campanhas");
    revalidatePath("/visao-geral");
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      updated: result.updated,
      invalid: parsed.invalid + result.invalid,
      rejected: parsed.rejected.slice(0, 8),
      ...board,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar clientes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
