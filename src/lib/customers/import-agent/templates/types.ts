import type { ParseCustomerResult } from "@/lib/customers/parse-sheet";
import type { ImportFileKind } from "@/lib/customers/import-agent/types";

export type TemplateMatchInput = {
  kind: ImportFileKind;
  filename?: string;
  /** Cabeçalhos da 1.ª linha (Excel/CSV), já normalizados. */
  headers?: string[];
  /** Amostra de texto (PDF ou CSV). */
  textSample?: string;
};

export type ImportTemplate = {
  id: string;
  /** Nome curto no preview. */
  label: string;
  /** Plataformas / origens conhecidas (documentação). */
  platforms: string[];
  kinds: Array<"xlsx" | "csv_text" | "pdf">;
  /**
   * 0 = não serve; quanto maior, mais específico.
   * O registry escolhe o maior score ≥ minScore.
   */
  matchScore: (input: TemplateMatchInput) => number;
  /** Excel/CSV: se omitido, usa parseCustomerGrid genérico. */
  parseGrid?: (grid: string[][]) => ParseCustomerResult;
  /** PDF: texto já com layout. */
  parsePdfText?: (text: string) => ParseCustomerResult;
};

export function normalizeHeaderKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function headersFromGrid(grid: string[][]): string[] {
  const row = grid[0] ?? [];
  return row.map((cell) => normalizeHeaderKey(cell));
}

export function hasAll(headers: string[], keys: string[]) {
  return keys.every((key) => headers.some((h) => h.includes(key) || h === key));
}

export function hasAny(headers: string[], keys: string[]) {
  return keys.some((key) => headers.some((h) => h.includes(key) || h === key));
}
