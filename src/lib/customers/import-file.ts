import {
  parseCustomerGrid,
  textToGrid,
  type ParseCustomerResult,
} from "@/lib/customers/parse-sheet";
import { looksLikeLegacyXls, looksLikeZip, xlsxBytesToGrid } from "@/lib/customers/xlsx-grid";

function decodeText(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("latin1").decode(bytes);
  }
  return utf8;
}

export function parseCustomerImportFile(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): ParseCustomerResult {
  if (looksLikeLegacyXls(input.bytes)) {
    throw new Error("Excel antigo (.xls) não entra. Salve como .xlsx ou CSV e envie de novo.");
  }

  if (looksLikeZip(input.bytes)) {
    try {
      const grid = xlsxBytesToGrid(input.bytes);
      if (grid.length === 0) {
        throw new Error("A planilha está vazia.");
      }
      return parseCustomerGrid(grid);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Excel") || message.includes("planilha") || message.includes("compressão")) {
        throw error;
      }
      throw new Error("Não consegui ler como planilha. Envie Excel (.xlsx), CSV ou TXT.");
    }
  }

  const grid = textToGrid(decodeText(input.bytes));
  if (grid.length === 0) {
    throw new Error("Arquivo vazio. Envie uma planilha ou um texto com nome e telefone.");
  }
  return parseCustomerGrid(grid);
}
