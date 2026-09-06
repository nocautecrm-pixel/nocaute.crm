import { detectImportKind } from "@/lib/customers/import-agent/detect";
import { extractCustomersFromLooseText } from "@/lib/customers/import-agent/loose-text";
import {
  bytesToBase64,
  extractCustomersWithAiText,
  extractCustomersWithAiVision,
  isImportAiReady,
} from "@/lib/customers/import-agent/llm";
import { extractPdfLayoutText } from "@/lib/customers/import-agent/pdf-layout";
import { extractPdfPlainText } from "@/lib/customers/import-agent/pdf-text";
import type { ImportAgentResult, ImportMethod } from "@/lib/customers/import-agent/types";
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

function finish(
  kind: ImportAgentResult["kind"],
  method: ImportMethod,
  parsed: ParseCustomerResult,
  notes: string[],
  aiUsed = false,
): ImportAgentResult {
  if (parsed.rows.length === 0) {
    throw new Error(
      notes[0] ??
        "Não encontrei clientes com telefone. Preciso de nome, WhatsApp, pedidos e dias sem pedir.",
    );
  }
  const labels: Record<ImportMethod, string> = {
    planilha: "Excel",
    texto_estruturado: "CSV/texto",
    texto_livre: "texto livre",
    pdf_texto: "PDF",
    ia_texto: "PDF + IA",
    ia_visao: "foto + IA",
  };
  return {
    kind,
    method,
    confidence: Math.min(99, parsed.rows.length >= 5 ? 90 : 70),
    rows: parsed.rows,
    invalid: parsed.invalid,
    rejected: parsed.rejected,
    notes,
    aiUsed,
    previewLabel: `${labels[method]} · ${parsed.rows.length} cliente(s)`,
  };
}

function parseGridOrThrow(grid: string[][], label: string): ParseCustomerResult {
  if (grid.length === 0) {
    throw new Error(`${label} veio vazio.`);
  }
  return parseCustomerGrid(grid);
}

/** Etapa Excel: só o parser de planilha (como antes). Sem disputa com IA/texto livre. */
function readXlsx(bytes: Uint8Array): ImportAgentResult {
  const grid = xlsxBytesToGrid(bytes);
  const parsed = parseGridOrThrow(grid, "A planilha");
  return finish("xlsx", "planilha", parsed, [
    "Etapa 1: formato Excel.",
    "Etapa 2: colunas nome · telefone · pedidos · dias sem pedir.",
  ]);
}

/** Etapa CSV/TXT: só grade tabular. */
function readCsvText(bytes: Uint8Array): ImportAgentResult {
  const text = decodeText(bytes);
  const grid = textToGrid(text);
  const parsed = parseGridOrThrow(grid, "O ficheiro de texto");
  return finish("csv_text", "texto_estruturado", parsed, [
    "Etapa 1: formato CSV/texto.",
    "Etapa 2: colunas nome · telefone · pedidos · dias sem pedir.",
  ]);
}

/** Etapa PDF: layout → grade; se falhar, IA (só neste formato). */
async function readPdf(bytes: Uint8Array): Promise<ImportAgentResult> {
  const notes = ["Etapa 1: formato PDF."];
  let layoutText = "";

  try {
    const layout = await extractPdfLayoutText(bytes);
    layoutText = layout.text;
    notes.push(`Etapa 2: layout (${layout.pages} página(s)).`);
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "Layout PDF falhou.");
  }

  if (!layoutText || layoutText.length < 12) {
    const plain = await extractPdfPlainText(bytes);
    layoutText = plain.text;
    notes.push(`Etapa 2b: texto simples (${plain.pages} página(s)).`);
  }

  if (layoutText.length >= 12) {
    // 3a) tentar como tabela
    try {
      const grid = textToGrid(layoutText.replace(/\t/g, ";"));
      const parsed = parseCustomerGrid(grid);
      if (parsed.rows.length >= 2) {
        notes.push("Etapa 3: lido como tabela (nome/telefone/pedidos/dias).");
        return finish("pdf", "pdf_texto", parsed, notes);
      }
    } catch {
      // segue
    }

    // 3b) linhas tipo "Nome - R$ … (19) 9 9669-8105" (relatórios de cardápio digital)
    const loose = extractCustomersFromLooseText(layoutText);
    if (loose.rows.length >= 2) {
      notes.push(`Etapa 3: ${loose.rows.length} contactos no texto do PDF.`);
      return finish("pdf", "texto_livre", loose, notes);
    }

    // 3c) IA só se o texto livre trouxe pouco
    if (isImportAiReady()) {
      notes.push("Etapa 3: IA a interpretar o PDF.");
      try {
        const ai = await extractCustomersWithAiText(layoutText);
        if (ai.rows.length > 0) {
          return finish("pdf", "ia_texto", ai, notes, true);
        }
      } catch (error) {
        notes.push(error instanceof Error ? error.message : "IA falhou.");
      }
    }

    if (loose.rows.length > 0) {
      notes.push("Etapa 3: telefones no texto do PDF (poucos).");
      return finish("pdf", "texto_livre", loose, notes);
    }
  }

  if (!isImportAiReady()) {
    throw new Error(
      "PDF sem lista clara. Envie CSV/Excel, ou configure OPENAI_API_KEY e tente de novo (ou um print).",
    );
  }
  throw new Error("Não consegui extrair clientes deste PDF. Tente CSV/Excel ou um print da lista.");
}

/** Etapa imagem: só visão. */
async function readImage(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): Promise<ImportAgentResult> {
  if (!isImportAiReady()) {
    throw new Error(
      "Para foto/print, configure OPENAI_API_KEY (ou CUSTOMER_IMPORT_AI_KEY) na Vercel/.env.local.",
    );
  }
  const mime =
    input.mime && input.mime.startsWith("image/")
      ? input.mime
      : input.filename.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";
  const parsed = await extractCustomersWithAiVision({
    mime,
    base64: bytesToBase64(input.bytes),
    hint: "Lista de clientes. Extrai cada pessoa: nome, telefone/WhatsApp, quantidade de pedidos, dias sem pedir.",
  });
  return finish(
    "image",
    "ia_visao",
    parsed,
    ["Etapa 1: formato imagem/print.", "Etapa 2: IA visual (nome · telefone · pedidos · dias)."],
    true,
  );
}

/**
 * Agent por etapas: 1) detectar formato → 2) um leitor só → 3) nome/telefone/pedidos/dias.
 * Excel/CSV não passam por IA nem por “texto livre” a competir.
 */
export async function runCustomerImportAgent(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): Promise<ImportAgentResult> {
  if (looksLikeLegacyXls(input.bytes)) {
    throw new Error("Excel antigo (.xls) não entra. Salve como .xlsx ou CSV e envie de novo.");
  }

  const kind =
    looksLikeZip(input.bytes) && detectImportKind(input) !== "pdf"
      ? "xlsx"
      : detectImportKind(input);

  if (kind === "xlsx") {
    return readXlsx(input.bytes);
  }
  if (kind === "csv_text") {
    return readCsvText(input.bytes);
  }
  if (kind === "pdf") {
    return readPdf(input.bytes);
  }
  if (kind === "image") {
    return readImage(input);
  }

  // unknown: tentar CSV/texto primeiro (comportamento antigo estável)
  try {
    return readCsvText(input.bytes);
  } catch {
    throw new Error(
      "Formato não reconhecido. Envie Excel (.xlsx), CSV, PDF com texto ou um print da lista.",
    );
  }
}
