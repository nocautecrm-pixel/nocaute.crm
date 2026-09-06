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
import {
  headersFromGrid,
  matchImportTemplate,
  type ImportTemplate,
} from "@/lib/customers/import-agent/templates";
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
  options?: { aiUsed?: boolean; templateLabel?: string },
): ImportAgentResult {
  if (parsed.rows.length === 0) {
    throw new Error(
      notes[0] ??
        "Não encontrei clientes com telefone. Preciso de nome, WhatsApp, pedidos e dias sem pedir.",
    );
  }
  const fallback: Record<ImportMethod, string> = {
    planilha: "Excel",
    texto_estruturado: "CSV/texto",
    texto_livre: "texto livre",
    pdf_texto: "PDF",
    ia_texto: "PDF + IA",
    ia_visao: "foto + IA",
  };
  const title = options?.templateLabel ?? fallback[method];
  return {
    kind,
    method,
    confidence: Math.min(99, parsed.rows.length >= 5 ? 90 : 70),
    rows: parsed.rows,
    invalid: parsed.invalid,
    rejected: parsed.rejected,
    notes,
    aiUsed: options?.aiUsed ?? false,
    previewLabel: `${title} · ${parsed.rows.length} cliente(s)`,
  };
}

function parseWithTemplateOrGrid(template: ImportTemplate | null, grid: string[][]) {
  if (template?.parseGrid) return template.parseGrid(grid);
  return parseCustomerGrid(grid);
}

/** Etapa Excel/CSV: deteta template do cardápio digital → um parser. */
function readSpreadsheet(input: {
  kind: "xlsx" | "csv_text";
  filename: string;
  bytes: Uint8Array;
}): ImportAgentResult {
  const grid =
    input.kind === "xlsx"
      ? xlsxBytesToGrid(input.bytes)
      : textToGrid(decodeText(input.bytes));

  if (grid.length === 0) {
    throw new Error(input.kind === "xlsx" ? "A planilha veio vazia." : "O ficheiro de texto veio vazio.");
  }

  const headers = headersFromGrid(grid);
  const textSample = grid
    .slice(0, 3)
    .map((row) => row.join(" "))
    .join("\n");

  const template = matchImportTemplate({
    kind: input.kind,
    filename: input.filename,
    headers,
    textSample,
  });

  const notes = [
    `Etapa 1: formato ${input.kind === "xlsx" ? "Excel" : "CSV/texto"}.`,
    template
      ? `Etapa 2: template «${template.label}» (${template.platforms[0] ?? template.id}).`
      : "Etapa 2: parser genérico de colunas.",
    "Etapa 3: nome · telefone/WhatsApp · pedidos · dias.",
  ];

  const parsed = parseWithTemplateOrGrid(template, grid);
  return finish(input.kind, input.kind === "xlsx" ? "planilha" : "texto_estruturado", parsed, notes, {
    templateLabel: template?.label,
  });
}

/** Etapa PDF: template conhecido → tabela → texto livre → IA. */
async function readPdf(bytes: Uint8Array, filename: string): Promise<ImportAgentResult> {
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
    const template = matchImportTemplate({
      kind: "pdf",
      filename,
      textSample: layoutText.slice(0, 4000),
    });

    if (template?.parsePdfText && !template.id.startsWith("generico")) {
      const report = template.parsePdfText(layoutText);
      if (report.rows.length >= 1) {
        notes.push(`Etapa 3: template «${template.label}» · ${report.rows.length} contacto(s).`);
        return finish("pdf", "pdf_texto", report, notes, { templateLabel: template.label });
      }
      notes.push(`Etapa 3: template «${template.label}» detetado, mas poucos contactos.`);
    }

    try {
      const grid = textToGrid(layoutText.replace(/\t/g, ";"));
      const parsed = parseCustomerGrid(grid);
      if (parsed.rows.length >= 2) {
        notes.push("Etapa 3: PDF lido como tabela genérica.");
        return finish("pdf", "pdf_texto", parsed, notes, { templateLabel: "PDF · tabela" });
      }
    } catch {
      // segue
    }

    const loose = extractCustomersFromLooseText(layoutText);
    if (loose.rows.length >= 2) {
      notes.push(`Etapa 3: ${loose.rows.length} contactos (texto livre).`);
      return finish("pdf", "texto_livre", loose, notes, { templateLabel: "PDF · texto livre" });
    }

    if (isImportAiReady()) {
      notes.push("Etapa 3: IA (template desconhecido).");
      try {
        const ai = await extractCustomersWithAiText(layoutText);
        if (ai.rows.length > 0) {
          return finish("pdf", "ia_texto", ai, notes, {
            aiUsed: true,
            templateLabel: "PDF · IA",
          });
        }
      } catch (error) {
        notes.push(error instanceof Error ? error.message : "IA falhou.");
      }
    }

    if (loose.rows.length > 0) {
      notes.push("Etapa 3: telefones no PDF (poucos).");
      return finish("pdf", "texto_livre", loose, notes, { templateLabel: "PDF · texto livre" });
    }
  }

  if (!isImportAiReady()) {
    throw new Error(
      "PDF sem lista clara. Envie CSV/Excel, ou configure OPENAI_API_KEY e tente de novo (ou um print).",
    );
  }
  throw new Error("Não consegui extrair clientes deste PDF. Tente CSV/Excel ou um print da lista.");
}

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
    hint: "Lista de clientes de cardápio digital. Extrai cada pessoa: nome, telefone/WhatsApp, quantidade de pedidos, dias sem pedir.",
  });
  return finish("image", "ia_visao", parsed, [
    "Etapa 1: formato imagem/print.",
    "Etapa 2: IA visual.",
  ], { aiUsed: true, templateLabel: "Foto · IA" });
}

/**
 * Agent por etapas:
 * 1) formato do ficheiro
 * 2) template de cardápio digital (catálogo)
 * 3) extrair nome · telefone · pedidos · dias
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
    return readSpreadsheet({ kind: "xlsx", filename: input.filename, bytes: input.bytes });
  }
  if (kind === "csv_text") {
    return readSpreadsheet({ kind: "csv_text", filename: input.filename, bytes: input.bytes });
  }
  if (kind === "pdf") {
    return readPdf(input.bytes, input.filename);
  }
  if (kind === "image") {
    return readImage(input);
  }

  try {
    return readSpreadsheet({ kind: "csv_text", filename: input.filename, bytes: input.bytes });
  } catch {
    throw new Error(
      "Formato não reconhecido. Envie Excel (.xlsx), CSV, PDF com texto ou um print da lista.",
    );
  }
}
