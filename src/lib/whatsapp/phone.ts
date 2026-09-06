export function toWhatsAppRecipient(phone: string) {
  return phone.replace(/\D/g, "");
}

export function digitsOnly(phone: string) {
  return toWhatsAppRecipient(phone);
}

export function phonesMatch(left: string, right: string) {
  return digitsOnly(left) === digitsOnly(right);
}

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
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

