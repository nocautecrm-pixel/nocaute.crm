import {
  lastPurchaseFromDaysAgo,
  parseDate,
  type ParseCustomerResult,
  type ParsedCustomerRow,
} from "@/lib/customers/parse-sheet";
import { normalizeToE164 } from "@/lib/whatsapp/phone";

const PHONE_CHUNK =
  /(?:\+?\d{1,3}[\s./-]?)?(?:\(?\d{2}\)?[\s./-]?)?\d{4,5}[\s./-]?\d{4}|\b\d{10,13}\b/g;

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

function guessNameNearPhone(line: string, phoneRaw: string) {
  const cleaned = line.replace(phoneRaw, " ").replace(/\s+/g, " ").trim();
  const withoutNoise = cleaned
    .replace(/\b(cliente|nome|tel|telefone|whatsapp|wpp|celular|fone)\b/gi, " ")
    .replace(/[|;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutNoise.length >= 2 && withoutNoise.length <= 80 && !/^\d+$/.test(withoutNoise)) {
    return withoutNoise;
  }
  return null;
}

function lineContext(lines: string[], index: number) {
  return [lines[index - 1], lines[index], lines[index + 1]].filter(Boolean).join(" · ");
}

/** Lê texto bagunçado (PDF, export feio, bloco copiado) e caça nome+telefone. */
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
    const matches = line.match(PHONE_CHUNK) ?? [];
    for (const raw of matches) {
      const phone = normalizeToE164(raw);
      if (!phone) {
        if (raw.replace(/\D/g, "").length >= 8) {
          invalid += 1;
          rejected.push(`Telefone inválido perto de: ${line.slice(0, 48)}`);
        }
        continue;
      }
      if (seen.has(phone)) continue;
      seen.add(phone);

      const name =
        guessNameNearPhone(line, raw) ??
        guessNameNearPhone(lineContext(lines, i), raw) ??
        `Cliente ${phone.slice(-4)}`;

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

  // Também tenta pares "Nome: X / Tel: Y" em blocos multilinha
  const blob = text.replace(/\s+/g, " ");
  const pairRe =
    /(?:nome|cliente)\s*[:\-]\s*([^|]{2,60}?)\s*(?:tel|telefone|whatsapp|celular|wpp)\s*[:\-]\s*([+\d()\s./-]{8,20})/gi;
  let pair: RegExpExecArray | null;
  while ((pair = pairRe.exec(blob))) {
    const phone = normalizeToE164(pair[2]);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const name = pair[1].trim();
    collected.push({
      name: name.length >= 2 ? name : `Cliente ${phone.slice(-4)}`,
      phone,
      lastPurchaseAt: null,
      orderCount: null,
      optIn: false,
      optInAt: null,
      optInSource: null,
      optInProof: null,
    });
  }

  return {
    rows: collapseByPhone(collected),
    invalid,
    rejected: rejected.slice(0, 8),
  };
}
