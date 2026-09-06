import {
  lastPurchaseFromDaysAgo,
  parseDate,
  type ParseCustomerResult,
  type ParsedCustomerRow,
} from "@/lib/customers/parse-sheet";
import { findBrazilianPhoneMatches, normalizeToE164 } from "@/lib/whatsapp/phone";

function collapseByPhone(rows: ParsedCustomerRow[]) {
  const map = new Map<string, ParsedCustomerRow>();
  for (const row of rows) {
    const prev = map.get(row.phone);
    if (!prev) {
      map.set(row.phone, row);
      continue;
    }
    map.set(row.phone, {
      ...prev,
      name: row.name.length >= prev.name.length ? row.name : prev.name,
      lastPurchaseAt:
        prev.lastPurchaseAt && row.lastPurchaseAt
          ? prev.lastPurchaseAt >= row.lastPurchaseAt
            ? prev.lastPurchaseAt
            : row.lastPurchaseAt
          : prev.lastPurchaseAt ?? row.lastPurchaseAt,
      orderCount:
        prev.orderCount !== null && row.orderCount !== null
          ? Math.max(prev.orderCount, row.orderCount)
          : prev.orderCount ?? row.orderCount,
    });
  }
  return [...map.values()];
}

function isReportNoise(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("relatório") ||
    lower.includes("relatorio") ||
    lower.includes("clientes em potencial") ||
    lower.includes("página") ||
    lower.includes("pagina") ||
    lower.includes("total de") ||
    /^cnpj\b/i.test(value)
  );
}

/** "João Pedro - R$ 0,00 (19) 9 9669-8105" → João Pedro */
function nameFromLine(line: string, phoneRaw: string) {
  let cleaned = line
    .replace(phoneRaw, " ")
    .replace(/R\$\s*[\d.]*\d,\d{2}/gi, " ")
    .replace(/R\$\s*[\d.,]+/gi, " ")
    .replace(/[-–—·|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Corta lixo depois de dois pontos de título.
  cleaned = cleaned.replace(/\bRelat[oó]rio:.*$/i, "").trim();
  if (isReportNoise(cleaned) || cleaned.length < 2) return null;
  if (cleaned.length > 80) cleaned = cleaned.slice(0, 80).trim();
  if (/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

function lineContext(lines: string[], index: number) {
  return [lines[index - 1], lines[index], lines[index + 1]].filter(Boolean).join(" · ");
}

/**
 * Lê texto de PDF/export (ex.: "Clientes em Potencial") e extrai
 * nome + WhatsApp BR, linha a linha.
 */
export function extractCustomersFromLooseText(text: string): ParseCustomerResult {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const collected: ParsedCustomerRow[] = [];
  let invalid = 0;
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isReportNoise(line) && findBrazilianPhoneMatches(line).length === 0) {
      continue;
    }

    const matches = findBrazilianPhoneMatches(line);
    if (matches.length === 0) {
      // Às vezes o nome está numa linha e o telefone na seguinte.
      const next = lines[i + 1] ?? "";
      const nextPhones = findBrazilianPhoneMatches(next);
      if (nextPhones.length === 1 && !findBrazilianPhoneMatches(line).length) {
        const phoneRaw = nextPhones[0];
        const phone = normalizeToE164(phoneRaw);
        if (phone && !seen.has(phone)) {
          const name = nameFromLine(line, "") ?? `Cliente ${phone.slice(-4)}`;
          if (!isReportNoise(name)) {
            seen.add(phone);
            collected.push({
              name,
              phone,
              lastPurchaseAt: null,
              orderCount: null,
              optIn: false,
              optInAt: null,
              optInSource: null,
              optInProof: null,
            });
          }
        }
      }
      continue;
    }

    for (const raw of matches) {
      const phone = normalizeToE164(raw);
      if (!phone) {
        invalid += 1;
        rejected.push(`Telefone inválido perto de: ${line.slice(0, 56)}`);
        continue;
      }
      if (seen.has(phone)) continue;
      seen.add(phone);

      const name =
        nameFromLine(line, raw) ??
        nameFromLine(lineContext(lines, i), raw) ??
        `Cliente ${phone.slice(-4)}`;

      if (isReportNoise(name)) {
        continue;
      }

      let lastPurchaseAt: string | null = null;
      const ctx = lineContext(lines, i);
      const dateMatch = ctx.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
      if (dateMatch) lastPurchaseAt = parseDate(dateMatch[1]);
      const daysMatch = ctx.match(/\b(\d{1,3})\s*dias?\b/i);
      if (!lastPurchaseAt && daysMatch) {
        lastPurchaseAt = lastPurchaseFromDaysAgo(Number(daysMatch[1]));
      }

      collected.push({
        name,
        phone,
        lastPurchaseAt,
        orderCount: null,
        optIn: false,
        optInAt: null,
        optInSource: null,
        optInProof: null,
      });
    }
  }

  return {
    rows: collapseByPhone(collected),
    invalid,
    rejected: rejected.slice(0, 8),
  };
}
