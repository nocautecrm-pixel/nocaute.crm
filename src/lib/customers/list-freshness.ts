export const LIST_REFRESH_DAYS = 30;
export const LIST_WARN_DAYS = 21;

export type ListFreshnessTone = "empty" | "ok" | "warn" | "stale" | "never";

export type ListFreshness = {
  importedAt: string | null;
  daysSinceImport: number | null;
  dueInDays: number | null;
  tone: ListFreshnessTone;
  title: string;
  detail: string;
};

function daysBetween(iso: string, now: Date) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

function dueLabel(days: number) {
  return days === 1 ? "1 dia" : `${days} dias`;
}

function daysAgoLabel(days: number) {
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

export function describeListFreshness({
  importedAt,
  customerCount,
  now = new Date(),
}: {
  importedAt: string | null;
  customerCount: number;
  now?: Date;
}): ListFreshness {
  if (customerCount === 0) {
    return {
      importedAt,
      daysSinceImport: importedAt ? daysBetween(importedAt, now) : null,
      dueInDays: null,
      tone: "empty",
      title: "Sem base ainda",
      detail: "Importe a planilha do caixa. O relógio de 30 dias começa nessa importação.",
    };
  }

  if (!importedAt) {
    return {
      importedAt: null,
      daysSinceImport: null,
      dueInDays: null,
      tone: "never",
      title: "Lista sem data de importação",
      detail: "Importe a planilha do mês para o “sumiu há” e os públicos acompanharem o caixa.",
    };
  }

  const days = daysBetween(importedAt, now);
  const dueInDays = Math.max(0, LIST_REFRESH_DAYS - days);

  if (days >= LIST_REFRESH_DAYS) {
    return {
      importedAt,
      daysSinceImport: days,
      dueInDays: 0,
      tone: "stale",
      title: `Lista desatualizada — ${daysAgoLabel(days)}`,
      detail: "O calor e o “sumiu há” podem estar mentindo. Importe a planilha nova do caixa.",
    };
  }

  if (days >= LIST_WARN_DAYS) {
    return {
      importedAt,
      daysSinceImport: days,
      dueInDays,
      tone: "warn",
      title: `Lista perto do mês — atualizada ${daysAgoLabel(days)}`,
      detail: `Faltam ${dueLabel(dueInDays)} para o ciclo de 30 dias. Importe de novo quando o caixa fechar o mês.`,
    };
  }

  return {
    importedAt,
    daysSinceImport: days,
    dueInDays,
    tone: "ok",
    title: `Lista atualizada ${daysAgoLabel(days)}`,
    detail: `Próxima importação sugerida em ${dueLabel(dueInDays)}.`,
  };
}
