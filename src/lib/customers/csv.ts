import { normalizeToE164 } from "@/lib/whatsapp/phone";
import {
  normalizeOptInSource,
  type OptInSource,
} from "@/lib/customers/opt-in";

export type ParsedCustomerRow = {
  name: string;
  phone: string;
  lastPurchaseAt: string;
  optIn: boolean;
  optInAt: string | null;
  optInSource: OptInSource | null;
  optInProof: string | null;
};

function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

function headerKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - 90);
    return fallback.toISOString();
  }
  const br = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseOptInFlag(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ["1", "sim", "s", "true", "yes", "y"].includes(normalized);
}

export function parseCustomerCsv(text: string): {
  rows: ParsedCustomerRow[];
  invalid: number;
  rejected: string[];
} {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return { rows: [], invalid: 0, rejected: [] };

  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const headerLine = lines[0] ?? "";
  const delimiter =
    (headerLine.match(/;/g) ?? []).length > (headerLine.match(/,/g) ?? []).length ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(headerKey);

  const nameIdx = headers.findIndex((key) => ["nome", "name", "cliente"].includes(key));
  const phoneIdx = headers.findIndex((key) =>
    ["whatsapp", "telefone", "phone", "celular", "numero"].includes(key),
  );
  const dateIdx = headers.findIndex((key) =>
    ["ultimacompra", "lastpurchase", "lastpurchaseat", "data", "compra"].includes(key),
  );
  const optIdx = headers.findIndex((key) => ["optin", "opt", "permissao", "consentimento"].includes(key));
  const optInDateIdx = headers.findIndex((key) =>
    ["optindata", "optindate", "dataconsentimento", "dataoptin"].includes(key),
  );
  const sourceIdx = headers.findIndex((key) =>
    ["optinorigem", "optinsource", "origem", "source", "fonte"].includes(key),
  );
  const proofIdx = headers.findIndex((key) =>
    ["optincomprovante", "optinproof", "comprovante", "proof", "referencia"].includes(key),
  );

  if (nameIdx < 0 || phoneIdx < 0) {
    throw new Error("A planilha precisa das colunas nome e whatsapp.");
  }
  if (sourceIdx < 0) {
    throw new Error(
      "Coluna opt_in_origem obrigatória (balcao, delivery, reserva, wifi ou confirmacao_whatsapp).",
    );
  }

  const rows: ParsedCustomerRow[] = [];
  let invalid = 0;
  const rejected: string[] = [];

  for (const [index, line] of lines.slice(1).entries()) {
    const cols = splitCsvLine(line, delimiter);
    const name = (cols[nameIdx] ?? "").trim();
    const phone = normalizeToE164(cols[phoneIdx] ?? "");
    const lastPurchaseAt = parseDate(cols[dateIdx] ?? "");
    const optIn = parseOptInFlag(cols[optIdx] ?? "");
    const optInAt = optIn ? parseDate(cols[optInDateIdx] ?? "") : null;
    const optInSource = normalizeOptInSource(cols[sourceIdx] ?? "");
    const optInProof = (cols[proofIdx] ?? "").trim() || null;

    if (!name || !phone || !lastPurchaseAt) {
      invalid += 1;
      continue;
    }

    if (!optIn) {
      rejected.push(`Linha ${index + 2}: opt_in deve ser sim — base fria não é permitida.`);
      invalid += 1;
      continue;
    }

    if (!optInSource) {
      rejected.push(`Linha ${index + 2}: opt_in_origem inválida ou vazia.`);
      invalid += 1;
      continue;
    }

    if (!optInProof) {
      rejected.push(`Linha ${index + 2}: opt_in_comprovante obrigatório (nº pedido, reserva, etc.).`);
      invalid += 1;
      continue;
    }

    rows.push({
      name,
      phone,
      lastPurchaseAt,
      optIn: true,
      optInAt: optInAt ?? new Date().toISOString(),
      optInSource,
      optInProof,
    });
  }

  return { rows, invalid, rejected };
}
