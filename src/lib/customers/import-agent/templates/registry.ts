import {
  excelPotentialClientsTemplate,
  genericPdfTemplate,
  genericSpreadsheetTemplate,
  nocauteModeloTemplate,
  pdfPotentialClientsTemplate,
} from "@/lib/customers/import-agent/templates/catalog";
import type {
  ImportTemplate,
  TemplateMatchInput,
} from "@/lib/customers/import-agent/templates/types";

/**
 * Catálogo de exports de cardápios digitais / CRM.
 * Ordem não importa: escolhemos pelo maior matchScore.
 * Para acrescentar uma plataforma: criar template em catalog.ts e registar aqui.
 */
export const IMPORT_TEMPLATES: ImportTemplate[] = [
  excelPotentialClientsTemplate,
  pdfPotentialClientsTemplate,
  nocauteModeloTemplate,
  genericSpreadsheetTemplate,
  genericPdfTemplate,
];

const MIN_SPECIFIC_SCORE = 8;

export function matchImportTemplate(input: TemplateMatchInput): ImportTemplate | null {
  const scored = IMPORT_TEMPLATES.map((template) => ({
    template,
    score: template.kinds.includes(input.kind as "xlsx" | "csv_text" | "pdf")
      ? template.matchScore(input)
      : 0,
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const best = scored[0];
  // Prefere template específico; genérico só se ninguém passou do limiar.
  if (best.score >= MIN_SPECIFIC_SCORE) return best.template;
  const specific = scored.find(
    (item) =>
      item.score >= MIN_SPECIFIC_SCORE ||
      (!item.template.id.startsWith("generico") && item.score >= 5),
  );
  return specific?.template ?? best.template;
}

export function listImportTemplates() {
  return IMPORT_TEMPLATES.map((template) => ({
    id: template.id,
    label: template.label,
    platforms: template.platforms,
    kinds: template.kinds,
  }));
}
