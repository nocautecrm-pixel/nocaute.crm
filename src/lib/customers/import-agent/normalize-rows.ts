import { normalizeOptInSource, type OptInSource } from "@/lib/customers/opt-in";
import { parseDate, type ParsedCustomerRow } from "@/lib/customers/parse-sheet";
import { normalizeToE164 } from "@/lib/whatsapp/phone";

export function normalizeImportRows(raw: unknown): ParsedCustomerRow[] {
  if (!Array.isArray(raw)) throw new Error("Lista de clientes inválida.");
  if (raw.length === 0) throw new Error("Nenhum cliente para importar.");
  if (raw.length > 5_000) throw new Error("Máximo 5.000 clientes por importação.");

  const out: ParsedCustomerRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const phone = normalizeToE164(String(row.phone ?? ""));
    if (!phone) continue;
    const name = String(row.name ?? "").trim();
    const optInSource = row.optInSource ? normalizeOptInSource(String(row.optInSource)) : null;
    const optInProof = row.optInProof ? String(row.optInProof).trim() || null : null;
    const optIn = Boolean(row.optIn && optInSource && optInProof);
    const lastPurchaseAt = row.lastPurchaseAt ? parseDate(String(row.lastPurchaseAt)) : null;
    const orderCount =
      typeof row.orderCount === "number" && Number.isFinite(row.orderCount)
        ? Math.max(0, Math.floor(row.orderCount))
        : null;

    out.push({
      name: name.length >= 2 ? name : `Cliente ${phone.slice(-4)}`,
      phone,
      lastPurchaseAt,
      orderCount,
      optIn,
      optInAt: optIn
        ? (row.optInAt ? parseDate(String(row.optInAt)) : null) ?? lastPurchaseAt ?? new Date().toISOString()
        : null,
      optInSource: optIn ? (optInSource as OptInSource) : null,
      optInProof: optIn ? optInProof : null,
    });
  }

  if (out.length === 0) throw new Error("Nenhum telefone válido na lista confirmada.");
  return out;
}
