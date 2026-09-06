import { normalizeOptInSource, type OptInSource } from "@/lib/customers/opt-in";
import { normalizeToE164 } from "@/lib/whatsapp/phone";

export type ParsedCustomerRow = {
  name: string;
  phone: string;
  lastPurchaseAt: string | null;
  orderCount: number | null;
  optIn: boolean;
  optInAt: string | null;
  optInSource: OptInSource | null;
  optInProof: string | null;
};

export type ParseCustomerResult = {
  rows: ParsedCustomerRow[];
  invalid: number;
  rejected: string[];
};

type ColumnMap = {
  name: number;
  phone: number;
  date: number;
  days: number;
  orders: number;
  optIn: number;
  optInDate: number;
  source: number;
  proof: number;
};

function headerKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitDelimitedLine(line: string, delimiter: string) {
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

function looksLikePhone(value: string) {
  return Boolean(normalizeToE164(value));
}

function parseOrderCount(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/\s*(pedidos?|compras?)$/, "");
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d{1,6}(\.0+)?$/.test(normalized)) return null;
  const count = Math.floor(Number(normalized));
  if (!Number.isFinite(count) || count < 0 || count > 100_000) return null;
  return count;
}

function parseDaysAgo(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/\s+dias?$/, "");
  if (!/^\d{1,4}([.,]\d+)?$/.test(trimmed)) return null;
  const days = Math.floor(Number(trimmed.replace(",", ".")));
  if (!Number.isFinite(days) || days < 0 || days > 4000) return null;
  return days;
}

function looksLikeDaysCount(value: string) {
  const days = parseDaysAgo(value);
  return days !== null && days <= 800;
}

export function lastPurchaseFromDaysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function looksLikeDate(value: string) {
  if (looksLikeDaysCount(value) && !value.includes("/") && !value.includes("-")) return false;
  return parseDate(value) !== null && value.trim() !== "";
}

export function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const serial = Number(trimmed.replace(",", "."));
  if (/^\d{4,6}(\.\d+)?$/.test(trimmed) && serial >= 20000 && serial <= 80000) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
    return new Date(utc).toISOString();
  }

  const brTime = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  );
  if (brTime) {
    const day = Number(brTime[1]);
    const month = Number(brTime[2]);
    const year = Number(brTime[3].length === 2 ? `20${brTime[3]}` : brTime[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day)).toISOString();
    }
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseOptInFlag(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ["1", "sim", "s", "true", "yes", "y", "ok"].includes(normalized);
}

function scoreHeader(kind: keyof ColumnMap, key: string) {
  if (!key) return 0;
  if (kind === "phone") {
    if (key.includes("whatsapp") || key === "wpp" || key === "zap") return 8;
    if (key.includes("celular") || key.includes("mobile")) return 6;
    if (key.includes("telefone") || key.includes("phone") || key === "fone" || key === "tel") return 5;
    if (key === "numero" || key.includes("fone")) return 2;
    return 0;
  }
  if (kind === "name") {
    if (key === "nome" || key === "name" || key.startsWith("nome")) return 8;
    if (key.includes("cliente") || key.includes("customer") || key === "contato") return 6;
    return 0;
  }
  if (kind === "date") {
    if (key.includes("optin") || key.includes("nasc") || key.includes("consent")) return 0;
    if (key.includes("quantidade") || key.includes("qtd") || key.includes("total")) return 0;
    if (key === "pedidos" || key === "orders" || key === "npedidos") return 0;
    if (key.includes("dias") || key.includes("naopede") || key.includes("sempedir")) return 0;
    if (key.includes("ultima") || key.includes("lastpurchase") || key.includes("lastvisit")) return 8;
    if (key.includes("pedido") || key.includes("compra") || key.includes("visita")) return 5;
    if (key === "data" || key === "date") return 3;
    return 0;
  }
  if (kind === "days") {
    if (key.includes("quantidade") || key.includes("qtd") || key.includes("optin") || key === "pedidos") return 0;
    if (key.includes("naopede") || key.includes("sempedir") || key.includes("semcompra")) return 10;
    if (key.includes("dias") && (key.includes("pede") || key.includes("pedir") || key.includes("compra") || key.includes("visita") || key.includes("sumiu"))) {
      return 10;
    }
    if (key.includes("recencia") || key.includes("inativ") || key.includes("ausenc")) return 7;
    if (key === "dias" || key.endsWith("dias") || key.startsWith("dias")) return 8;
    if (key.includes("dayssince") || key.includes("dayssincelast")) return 8;
    return 0;
  }
  if (kind === "orders") {
    if (key === "pedidos" || key === "orders" || key === "npedidos") return 10;
    if (key.includes("qtd") && key.includes("pedido")) return 8;
    if (key === "quantidade" || key === "qtd" || key === "totalpedidos") return 4;
    return 0;
  }
  if (kind === "optIn") {
    if (key === "optin" || key === "opt" || key.includes("permissao") || key.includes("consentimento")) return 6;
    return 0;
  }
  if (kind === "optInDate") {
    if (key.includes("optin") && (key.includes("data") || key.includes("date"))) return 6;
    if (key.includes("dataconsentimento")) return 6;
    return 0;
  }
  if (kind === "source") {
    if (key.includes("origem") || key.includes("source") || key.includes("fonte")) return 6;
    return 0;
  }
  if (kind === "proof") {
    if (key.includes("quantidade") || key.includes("qtd") || key === "pedidos") return 0;
    if (key.includes("comprovante") || key.includes("proof") || key.includes("referencia")) return 6;
    if (key.includes("pedido") && !key.includes("data") && !key.includes("ultima")) return 2;
    return 0;
  }
  return 0;
}

function pickHeaderIndex(headers: string[], kind: keyof ColumnMap) {
  let best = -1;
  let bestScore = 0;
  headers.forEach((header, index) => {
    const score = scoreHeader(kind, header);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return bestScore > 0 ? best : -1;
}

function inferDaysIndex(grid: string[][], phone: number) {
  const width = Math.max(0, ...grid.map((row) => row.length));
  let best = -1;
  let bestScore = 0;
  for (let col = width - 1; col >= 0; col -= 1) {
    if (col === phone) continue;
    let score = 0;
    for (const row of grid.slice(0, 40)) {
      const value = row[col] ?? "";
      if (looksLikeDaysCount(value) && !looksLikePhone(value)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return bestScore > 0 ? best : -1;
}

function inferIndex(grid: string[][], kind: "phone" | "date" | "name") {
  const width = Math.max(0, ...grid.map((row) => row.length));
  let best = -1;
  let bestScore = 0;
  for (let col = 0; col < width; col += 1) {
    let score = 0;
    for (const row of grid.slice(0, 40)) {
      const value = row[col] ?? "";
      if (kind === "phone" && looksLikePhone(value)) score += 1;
      if (kind === "date" && looksLikeDate(value) && !looksLikePhone(value)) score += 1;
      if (
        kind === "name" &&
        value.trim().length >= 2 &&
        !looksLikePhone(value) &&
        !looksLikeDate(value) &&
        !looksLikeDaysCount(value)
      ) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return bestScore > 0 ? best : -1;
}

function detectDelimiter(sample: string) {
  const line = sample.split(/\r?\n/).find((item) => item.trim()) ?? "";
  const counts = [
    { delimiter: ";", count: (line.match(/;/g) ?? []).length },
    { delimiter: "\t", count: (line.match(/\t/g) ?? []).length },
    { delimiter: ",", count: (line.match(/,/g) ?? []).length },
    { delimiter: "|", count: (line.match(/\|/g) ?? []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ",";
}

export function textToGrid(text: string): string[][] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const delimiter = detectDelimiter(raw);
  return raw
    .split(/\r?\n/)
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((row) => row.some((cell) => cell.trim()));
}

function headerRowIndex(grid: string[][]) {
  const limit = Math.min(grid.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const headers = grid[i].map(headerKey);
    const phone = pickHeaderIndex(headers, "phone");
    const name = pickHeaderIndex(headers, "name");
    if (phone >= 0 && (name >= 0 || pickHeaderIndex(headers, "date") >= 0 || pickHeaderIndex(headers, "days") >= 0)) {
      return i;
    }
    if (phone >= 0) return i;
  }
  return -1;
}

function resolveColumns(grid: string[][]): { map: ColumnMap; dataStart: number } {
  const headerAt = headerRowIndex(grid);
  if (headerAt >= 0) {
    const headers = grid[headerAt].map(headerKey);
    const map: ColumnMap = {
      name: pickHeaderIndex(headers, "name"),
      phone: pickHeaderIndex(headers, "phone"),
      date: pickHeaderIndex(headers, "date"),
      days: pickHeaderIndex(headers, "days"),
      orders: pickHeaderIndex(headers, "orders"),
      optIn: pickHeaderIndex(headers, "optIn"),
      optInDate: pickHeaderIndex(headers, "optInDate"),
      source: pickHeaderIndex(headers, "source"),
      proof: pickHeaderIndex(headers, "proof"),
    };
    if (map.days < 0 && map.date < 0 && map.phone >= 0) {
      map.days = inferDaysIndex(grid.slice(headerAt + 1), map.phone);
    }
    return { dataStart: headerAt + 1, map };
  }

  const body = grid;
  const phone = inferIndex(body, "phone");
  let name = inferIndex(body, "name");
  const date = inferIndex(body, "date");
  let days = inferDaysIndex(body, phone);
  if (name === phone || name === date || name === days) {
    name = body[0]?.findIndex((_, index) => index !== phone && index !== date && index !== days) ?? -1;
  }
  if (days === date && date >= 0) days = -1;
  return {
    dataStart: 0,
    map: {
      name,
      phone,
      date,
      days,
      orders: -1,
      optIn: -1,
      optInDate: -1,
      source: -1,
      proof: -1,
    },
  };
}

function newerIso(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function collapseByPhone(rows: ParsedCustomerRow[]) {
  const byPhone = new Map<string, ParsedCustomerRow>();
  for (const row of rows) {
    const current = byPhone.get(row.phone);
    if (!current) {
      byPhone.set(row.phone, row);
      continue;
    }
    const lastPurchaseAt = newerIso(current.lastPurchaseAt, row.lastPurchaseAt);
    const preferIncomingOptIn = row.optIn && row.optInSource && row.optInProof;
    byPhone.set(row.phone, {
      name: row.name.length >= current.name.length ? row.name : current.name,
      phone: row.phone,
      lastPurchaseAt,
      orderCount:
        current.orderCount !== null && row.orderCount !== null
          ? Math.max(current.orderCount, row.orderCount)
          : current.orderCount ?? row.orderCount,
      optIn: preferIncomingOptIn ? true : current.optIn,
      optInAt: preferIncomingOptIn ? row.optInAt : current.optInAt,
      optInSource: preferIncomingOptIn ? row.optInSource : current.optInSource,
      optInProof: preferIncomingOptIn ? row.optInProof : current.optInProof,
    });
  }
  return [...byPhone.values()];
}

export function parseCustomerGrid(grid: string[][]): ParseCustomerResult {
  if (grid.length === 0) {
    return { rows: [], invalid: 0, rejected: [] };
  }

  const { map, dataStart } = resolveColumns(grid);
  if (map.phone < 0) {
    throw new Error("Não achei uma coluna de WhatsApp ou telefone nesse arquivo.");
  }

  const collected: ParsedCustomerRow[] = [];
  let invalid = 0;
  const rejected: string[] = [];

  for (const [offset, cols] of grid.slice(dataStart).entries()) {
    const line = dataStart + offset + 1;
    const phone = normalizeToE164(cols[map.phone] ?? "");
    if (!phone) {
      if ((cols[map.phone] ?? "").trim()) {
        invalid += 1;
        rejected.push(`Linha ${line}: telefone inválido.`);
      }
      continue;
    }

    const rawName = (map.name >= 0 ? cols[map.name] : "").trim();
    const name = rawName.length >= 2 ? rawName : `Cliente ${phone.slice(-4)}`;
    const fromDate = map.date >= 0 ? parseDate(cols[map.date] ?? "") : null;
    const daysAgo = map.days >= 0 ? parseDaysAgo(cols[map.days] ?? "") : null;
    const orderCount = map.orders >= 0 ? parseOrderCount(cols[map.orders] ?? "") : null;
    const lastPurchaseAt =
      fromDate ?? (daysAgo !== null ? lastPurchaseFromDaysAgo(daysAgo) : null);
    const hasOptColumn = map.optIn >= 0;
    const optFlag = hasOptColumn ? parseOptInFlag(cols[map.optIn] ?? "") : null;
    const optInSource = map.source >= 0 ? normalizeOptInSource(cols[map.source] ?? "") : null;
    const optInProof = map.proof >= 0 ? (cols[map.proof] ?? "").trim() || null : null;
    const optIn = Boolean(optInSource && optInProof && optFlag !== false);

    if (hasOptColumn && optFlag && (!optInSource || !optInProof)) {
      rejected.push(
        `Linha ${line}: opt-in sem origem ou comprovante — contato entra sem permissão de campanha.`,
      );
    }

    collected.push({
      name,
      phone,
      lastPurchaseAt,
      orderCount,
      optIn,
      optInAt: optIn
        ? (map.optInDate >= 0 ? parseDate(cols[map.optInDate] ?? "") : lastPurchaseAt) ??
          new Date().toISOString()
        : null,
      optInSource: optIn ? optInSource : null,
      optInProof: optIn ? optInProof : null,
    });
  }

  return { rows: collapseByPhone(collected), invalid, rejected: rejected.slice(0, 8) };
}

export function parseCustomerCsv(text: string): ParseCustomerResult {
  return parseCustomerGrid(textToGrid(text));
}

export function isExcelFilename(filename: string, mime = "") {
  const name = filename.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel"
  );
}
