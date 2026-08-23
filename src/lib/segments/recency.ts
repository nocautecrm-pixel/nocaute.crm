import type { RecencySegment } from "@/types/database";

export const CAMPAIGN_WINDOW_MAX_DAYS = 120;

export const RECENCY_SEGMENTS: Record<
  RecencySegment,
  { minDays: number; maxDays: number; label: string; hint: string }
> = {
  ativos: {
    minDays: 0,
    maxDays: 15,
    label: "Ativos",
    hint: "Vieram nos últimos 15 dias",
  },
  em_risco: {
    minDays: 16,
    maxDays: 30,
    label: "Em risco",
    hint: "16 a 30 dias sem vir",
  },
  inativos: {
    minDays: 31,
    maxDays: 60,
    label: "Inativos",
    hint: "31 a 60 dias sem vir",
  },
  perdidos: {
    minDays: 61,
    maxDays: CAMPAIGN_WINDOW_MAX_DAYS,
    label: "Perdidos",
    hint: "Mais de 60 a 120 dias sem vir",
  },
};

export function daysSince(lastPurchaseAt: Date | string | null, now = new Date()) {
  if (!lastPurchaseAt) return Number.POSITIVE_INFINITY;
  const date = typeof lastPurchaseAt === "string" ? new Date(lastPurchaseAt) : lastPurchaseAt;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function isOutsideCampaignWindow(days: number) {
  return days > CAMPAIGN_WINDOW_MAX_DAYS;
}

export function segmentForDays(days: number): RecencySegment | null {
  if (days <= 15) return "ativos";
  if (days <= 30) return "em_risco";
  if (days <= 60) return "inativos";
  if (days <= CAMPAIGN_WINDOW_MAX_DAYS) return "perdidos";
  return null;
}

export function situationLabel(days: number) {
  const segment = segmentForDays(days);
  if (!segment) return "Fora da janela";
  return RECENCY_SEGMENTS[segment].label;
}

export function matchesSegment(days: number, segment: RecencySegment) {
  const { minDays, maxDays } = RECENCY_SEGMENTS[segment];
  return days >= minDays && days <= maxDays;
}

/** Data de última visita no meio da faixa, para o lojista mudar a situação sem calcular dias. */
export function lastPurchaseForSegment(segment: RecencySegment, now = new Date()) {
  const days = { ativos: 7, em_risco: 23, inativos: 45, perdidos: 90 }[segment];
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
