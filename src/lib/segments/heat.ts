export type Heat = "quente" | "morno" | "frio";

export const HEAT = {
  quente: {
    minDays: 0,
    maxDays: 15,
    label: "Quente",
    hint: "Pediu nos últimos 15 dias",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  morno: {
    minDays: 16,
    maxDays: 45,
    label: "Morno",
    hint: "16 a 45 dias sem pedir",
    className: "bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  frio: {
    minDays: 46,
    maxDays: 120,
    label: "Frio",
    hint: "46 a 120 dias sem pedir",
    className: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
} as const;

export function heatForDays(days: number): Heat | null {
  if (days <= HEAT.quente.maxDays) return "quente";
  if (days <= HEAT.morno.maxDays) return "morno";
  if (days <= HEAT.frio.maxDays) return "frio";
  return null;
}

export function heatLabel(days: number) {
  const heat = heatForDays(days);
  if (!heat) return "Fora da janela";
  return HEAT[heat].label;
}
