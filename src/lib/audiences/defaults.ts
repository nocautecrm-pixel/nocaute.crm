import { CAMPAIGN_WINDOW_MAX_DAYS, RECENCY_SEGMENTS } from "@/lib/segments/recency";

export const DEFAULT_AUDIENCES = (
  ["ativos", "em_risco", "inativos", "perdidos"] as const
).map((slug) => ({
  slug,
  name: RECENCY_SEGMENTS[slug].label,
  minDays: RECENCY_SEGMENTS[slug].minDays,
  maxDays: RECENCY_SEGMENTS[slug].maxDays,
}));

/** Públicos padrão criados na versão de calor — viram Ativos / Em risco / Inativos / Perdidos. */
export const LEGACY_HEAT_AUDIENCE_SLUGS: Record<string, string> = {
  quentes: "ativos",
  mornos: "em_risco",
  sumiram: "inativos",
  frios: "perdidos",
};

export function matchesAudienceDays(days: number, minDays: number, maxDays: number) {
  if (!Number.isFinite(days)) return false;
  return days >= minDays && days <= Math.min(maxDays, CAMPAIGN_WINDOW_MAX_DAYS);
}

export function audienceRangeLabel(minDays: number, maxDays: number) {
  return minDays === maxDays ? `${minDays} dias` : `${minDays}–${maxDays} dias`;
}

export function slugFromName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || `publico-${Date.now().toString(36)}`;
}
