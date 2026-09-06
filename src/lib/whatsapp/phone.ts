export function toWhatsAppRecipient(phone: string) {
  return phone.replace(/\D/g, "");
}

export function digitsOnly(phone: string) {
  return toWhatsAppRecipient(phone);
}

export function phonesMatch(left: string, right: string) {
  return digitsOnly(left) === digitsOnly(right);
}

/** Celular/fixixo BR com DDD — ignora CNPJ (14 dígitos) e lixo. */
export function normalizeToE164(input: string): string | null {
  let raw = input.trim();
  // Excel grava telefone longo em notação científica (5.51119E12).
  if (/^\d+(\.\d+)?e[+\-]?\d+$/i.test(raw)) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      raw = Math.round(asNumber).toString();
    }
  }

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);

  // CNPJ / inscrição: 14 dígitos sem ser telefone.
  if (digits.length === 14) return null;

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    if (local.length === 10 || local.length === 11) return `+${digits}`;
    return null;
  }

  // DDD + número (fixixo 10 / celular 11).
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return null;
}

/**
 * Encontra candidatos a telefone BR no texto, inclusive com espaços
 * no estilo "(19) 9 9669-8105".
 */
export function findBrazilianPhoneMatches(text: string): string[] {
  const patterns = [
    // (11) 9 9669-8105  |  (11) 99669-8105  |  11 9 9669-8105
    /\(?\d{2}\)?\s*9?\s*\d{4,5}\s*-?\s*\d{4}/g,
    // 11996698105 / 5511996698105
    /\b(?:55)?\d{10,11}\b/g,
  ];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? [];
    for (const raw of matches) {
      const phone = normalizeToE164(raw);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      found.push(raw);
    }
  }
  return found;
}
