export function formatWhatsAppPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function qualityLabel(rating: string | null | undefined) {
  const value = (rating ?? "").toUpperCase();
  if (value === "GREEN" || value === "HIGH") return "Alta";
  if (value === "YELLOW" || value === "MEDIUM") return "Média";
  if (value === "RED" || value === "LOW" || value === "FLAGGED") return "Baixa";
  return null;
}
