import type { ParseCustomerResult, ParsedCustomerRow } from "@/lib/customers/parse-sheet";

export type ImportFileKind =
  | "xlsx"
  | "csv_text"
  | "pdf"
  | "image"
  | "unknown";

export type ImportMethod =
  | "planilha"
  | "texto_estruturado"
  | "texto_livre"
  | "pdf_texto"
  | "ia_texto"
  | "ia_visao";

export type ImportCandidate = ParseCustomerResult & {
  method: ImportMethod;
  confidence: number;
  notes: string[];
};

export type ImportAgentResult = {
  kind: ImportFileKind;
  method: ImportMethod;
  confidence: number;
  rows: ParsedCustomerRow[];
  invalid: number;
  rejected: string[];
  notes: string[];
  aiUsed: boolean;
  previewLabel: string;
};
