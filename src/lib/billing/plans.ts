export const PLANS = [
  {
    slug: "basico" as const,
    name: "Básico",
    priceCents: 14000,
    includedLeads: 700,
  },
  {
    slug: "intermediario" as const,
    name: "Intermediário",
    priceCents: 25000,
    includedLeads: 1400,
  },
  {
    slug: "pro" as const,
    name: "Pro",
    priceCents: 34000,
    includedLeads: 3000,
  },
] as const;

export type PlanSlug = (typeof PLANS)[number]["slug"];

export const DEFAULT_PLAN = PLANS[0];

export type QuotaSnapshot = {
  planSlug: PlanSlug;
  planName: string;
  priceCents: number;
  included: number;
  extra: number;
  used: number;
  reserved: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
};

export function remainingOf(input: {
  included: number;
  extra: number;
  used: number;
  reserved: number;
}) {
  return Math.max(0, input.included + input.extra - input.used - input.reserved);
}

export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded" as const;

  constructor(
    public readonly remaining: number,
    public readonly needed: number,
    public readonly included: number,
    public readonly planName: string,
  ) {
    super(
      `A campanha precisa de ${needed} lead(s) da ferramenta. Restam ${remaining} no plano ${planName} (${included}/mês). Faça upgrade para continuar a automação — o WhatsApp da Meta continua livre.`,
    );
    this.name = "QuotaExceededError";
  }
}

export function currentCalendarPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
