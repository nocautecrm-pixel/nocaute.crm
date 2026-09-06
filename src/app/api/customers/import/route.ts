import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { normalizeImportRows } from "@/lib/customers/import-agent/normalize-rows";
import { isImportAiReady } from "@/lib/customers/import-agent/llm";
import { parseCustomerImportFile } from "@/lib/customers/import-file";
import { getCustomerBoard } from "@/server/customer-board";
import { importCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8_000_000;

function revalidateCustomerPaths() {
  revalidatePath("/clientes");
  revalidatePath("/campanhas");
  revalidatePath("/visao-geral");
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // Confirmação do preview (JSON com linhas já interpretadas pelo agent).
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { rows?: unknown };
      const rows = normalizeImportRows(body.rows);
      const restaurantId = await getCurrentRestaurantId();
      const result = await importCustomers(restaurantId, rows);
      const board = await getCustomerBoard(restaurantId);
      revalidateCustomerPaths();
      return NextResponse.json({
        ok: true,
        imported: result.imported,
        updated: result.updated,
        invalid: result.invalid,
        ...board,
      });
    }

    const form = await request.formData();
    const mode = String(form.get("mode") ?? "import");
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie CSV, Excel, PDF, TXT ou uma foto/print da lista." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 8 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const analyzed = await parseCustomerImportFile({
      filename: file.name,
      mime: file.type,
      bytes,
    });

    if (mode === "analyze") {
      return NextResponse.json({
        ok: true,
        kind: analyzed.kind,
        method: analyzed.method,
        confidence: analyzed.confidence,
        previewLabel: analyzed.previewLabel,
        notes: analyzed.notes,
        aiUsed: analyzed.aiUsed,
        aiReady: isImportAiReady(),
        invalid: analyzed.invalid,
        rejected: analyzed.rejected,
        rows: analyzed.rows,
        count: analyzed.rows.length,
      });
    }

    const restaurantId = await getCurrentRestaurantId();
    const result = await importCustomers(restaurantId, analyzed.rows);
    const board = await getCustomerBoard(restaurantId);
    revalidateCustomerPaths();
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      updated: result.updated,
      invalid: analyzed.invalid + result.invalid,
      rejected: analyzed.rejected.slice(0, 8),
      method: analyzed.method,
      previewLabel: analyzed.previewLabel,
      ...board,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar clientes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
