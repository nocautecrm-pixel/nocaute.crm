export const OPT_IN_SOURCES = [
  "balcao",
  "delivery",
  "reserva",
  "wifi",
  "confirmacao_whatsapp",
  "recusa_whatsapp",
] as const;

export type OptInSource = (typeof OPT_IN_SOURCES)[number];

const SOURCE_ALIASES: Record<string, OptInSource> = {
  balcao: "balcao",
  balcão: "balcao",
  caixa: "balcao",
  delivery: "delivery",
  entrega: "delivery",
  ifood: "delivery",
  reserva: "reserva",
  reservas: "reserva",
  wifi: "wifi",
  "wi-fi": "wifi",
  captive: "wifi",
  confirmacao: "confirmacao_whatsapp",
  confirmacao_whatsapp: "confirmacao_whatsapp",
  whatsapp: "confirmacao_whatsapp",
  recusa_whatsapp: "recusa_whatsapp",
  recusa: "recusa_whatsapp",
};

export const OPT_IN_SOURCE_LABELS: Record<OptInSource, string> = {
  balcao: "Balcão / caixa",
  delivery: "Pedido delivery",
  reserva: "Reserva",
  wifi: "Wi-Fi / portal",
  confirmacao_whatsapp: "Confirmação WhatsApp",
  recusa_whatsapp: "Não receber oferta (WhatsApp)",
};

export function normalizeOptInSource(raw: string): OptInSource | null {
  const key = raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) return null;
  if (SOURCE_ALIASES[key]) return SOURCE_ALIASES[key];
  if ((OPT_IN_SOURCES as readonly string[]).includes(key)) return key as OptInSource;
  return null;
}

export function customerFirstName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return "Cliente";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function hasProvenOptIn(input: {
  optIn: boolean;
  optInAt?: string | null;
  optInSource?: string | null;
  optInProof?: string | null;
}) {
  return Boolean(
    input.optIn &&
      input.optInAt &&
      input.optInSource?.trim() &&
      input.optInProof?.trim(),
  );
}
