import { lastPurchaseFromDaysAgo, type ParseCustomerResult, type ParsedCustomerRow } from "@/lib/customers/parse-sheet";
import { findBrazilianPhoneMatches, normalizeToE164 } from "@/lib/whatsapp/phone";

/**
 * Padrão fixo do PDF "Relatório: Clientes em Potencial":
 * Nome do Cliente | Dias sem comprar | Total de pedidos (R$) | Número de Telefone
 * Telefone: (19) 9 9669-8105
 */

export function looksLikePotentialClientsReport(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("clientes em potencial") ||
    (lower.includes("nome do cliente") &&
      (lower.includes("dias sem comprar") || lower.includes("número de telefone") || lower.includes("numero de telefone")))
  );
}

function isHeaderOrNoise(line: string) {
  const lower = line.toLowerCase();
  return (
    lower.includes("relatório") ||
    lower.includes("relatorio") ||
    lower.includes("clientes em potencial") ||
    lower.includes("nome do cliente") ||
    lower.includes("dias sem comprar") ||
    lower.includes("total de pedidos") ||
    lower.includes("número de telefone") ||
    lower.includes("numero de telefone") ||
    /^cnpj\b/i.test(lower) ||
    /^\d{14}$/.test(line.replace(/\D/g, "")) // CNPJ sozinho
  );
}

function parseDaysToken(token: string): number | null {
  const t = token.trim();
  if (!t || t === "-" || t === "—" || t === "–") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 4000) return null;
  return Math.floor(n);
}

function nameFromRemainder(raw: string) {
  let name = raw
    .replace(/R\$\s*[\d.]*\d,\d{2}/gi, " ")
    .replace(/R\$\s*[\d.,]+/gi, " ")
    .replace(/\b\d{1,4}\b/g, " ") // dias soltos
    .replace(/[-–—·|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) return null;
  if (isHeaderOrNoise(name)) return null;
  if (name.length > 80) name = name.slice(0, 80).trim();
  return name;
}

function rowFromLine(line: string): ParsedCustomerRow | null {
  const phones = findBrazilianPhoneMatches(line);
  if (phones.length === 0) return null;
  const phoneRaw = phones[phones.length - 1];
  const phone = normalizeToE164(phoneRaw);
  if (!phone) return null;

  const beforePhone = line.slice(0, line.lastIndexOf(phoneRaw)).trim();

  // Preferir colunas por TAB (layout PDF).
  const tabs = beforePhone.split("\t").map((c) => c.trim());
  let name: string | null = null;
  let days: number | null = null;

  if (tabs.length >= 2) {
    name = tabs[0] ? nameFromRemainder(tabs[0]) : null;
    days = parseDaysToken(tabs[1] ?? "");
  } else {
    // "João Pedro - R$ 0,00" ou "João Pedro - - R$ 0,00"
    const daysMatch = beforePhone.match(/(?:^|[\s|])(-|\d{1,4})(?=\s*(?:R\$|-|$))/);
    if (daysMatch) days = parseDaysToken(daysMatch[1]);
    name = nameFromRemainder(beforePhone);
  }

  return {
    name: name && name.length >= 2 ? name : `Cliente ${phone.slice(-4)}`,
    phone,
    lastPurchaseAt: days !== null ? lastPurchaseFromDaysAgo(days) : null,
    orderCount: null, // neste relatório a coluna é R$, não quantidade
    optIn: false,
    optInAt: null,
    optInSource: null,
    optInProof: null,
  };
}

export function extractPotentialClientsReport(text: string): ParseCustomerResult {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const collected: ParsedCustomerRow[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  const rejected: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isHeaderOrNoise(line) && findBrazilianPhoneMatches(line).length === 0) {
      continue;
    }

    // Nome numa linha, telefone na seguinte (célula vazia de nome às vezes).
    if (findBrazilianPhoneMatches(line).length === 0) {
      const next = lines[i + 1] ?? "";
      const nextPhones = findBrazilianPhoneMatches(next);
      if (nextPhones.length >= 1 && /R\$|\t|-/.test(next)) {
        const merged = `${line}\t${next}`;
        const row = rowFromLine(merged);
        if (row && !seen.has(row.phone)) {
          seen.add(row.phone);
          collected.push(row);
          i += 1;
        }
      }
      continue;
    }

    const row = rowFromLine(line);
    if (!row) {
      invalid += 1;
      rejected.push(`Linha sem telefone válido: ${line.slice(0, 48)}`);
      continue;
    }
    if (seen.has(row.phone)) continue;
    seen.add(row.phone);
    collected.push(row);
  }

  return {
    rows: collected,
    invalid,
    rejected: rejected.slice(0, 8),
  };
}
