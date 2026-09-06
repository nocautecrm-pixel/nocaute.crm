import { detectImportKind } from "@/lib/customers/import-agent/detect";
import { extractCustomersFromLooseText } from "@/lib/customers/import-agent/loose-text";
import {
  bytesToBase64,
  extractCustomersWithAiText,
  extractCustomersWithAiVision,
  isImportAiReady,
} from "@/lib/customers/import-agent/llm";
import { extractPdfPlainText } from "@/lib/customers/import-agent/pdf-text";
import { pickBestCandidate, toCandidate } from "@/lib/customers/import-agent/score";
import type { ImportAgentResult, ImportCandidate } from "@/lib/customers/import-agent/types";
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

function safeGridParse(grid: string[][], notes: string[]): ParseCustomerResult | null {
  if (grid.length === 0) return null;
  try {
    return parseCustomerGrid(grid);
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "Falha na leitura em grade.");
    return null;
  }
}

function previewLabel(result: ImportAgentResult) {
  const methodLabels: Record<string, string> = {
    planilha: "planilha (Excel)",
    texto_estruturado: "texto/CSV estruturado",
    texto_livre: "texto livre (caçou telefones)",
    pdf_texto: "PDF (texto + interpretação)",
    ia_texto: "IA no texto do ficheiro",
    ia_visao: "IA visual (imagem/scan)",
  };
  return `${methodLabels[result.method] ?? result.method} · ${result.rows.length} contacto(s) · confiança ${result.confidence}`;
}

async function tryAiText(text: string, notes: string[]): Promise<ImportCandidate | null> {
  if (!isImportAiReady() || text.trim().length < 20) return null;
  try {
    const parsed = await extractCustomersWithAiText(text);
    return toCandidate("ia_texto", parsed, ["Interpretação por IA no conteúdo textual."]);
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "IA texto falhou.");
    return null;
  }
}

async function tryAiVision(input: {
  mime: string;
  bytes: Uint8Array;
  notes: string[];
  hint?: string;
}): Promise<ImportCandidate | null> {
  if (!isImportAiReady()) return null;
  try {
    const parsed = await extractCustomersWithAiVision({
      mime: input.mime,
      base64: bytesToBase64(input.bytes),
      hint: input.hint,
    });
    return toCandidate("ia_visao", parsed, ["Interpretação visual por IA."]);
  } catch (error) {
    input.notes.push(error instanceof Error ? error.message : "IA visão falhou.");
    return null;
  }
}

/**
 * Agent: tenta vários leitores e fica com o melhor resultado (não há formato “preferido”).
 */
export async function runCustomerImportAgent(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): Promise<ImportAgentResult> {
  if (looksLikeLegacyXls(input.bytes)) {
    throw new Error("Excel antigo (.xls) não entra. Salve como .xlsx, CSV ou PDF e envie de novo.");
  }

  const kind = detectImportKind(input);
  const notes: string[] = [];
  const candidates: ImportCandidate[] = [];
  let aiUsed = false;

  const push = (candidate: ImportCandidate | null) => {
    if (!candidate) return;
    if (candidate.method.startsWith("ia_")) aiUsed = true;
    candidates.push(candidate);
  };

  if (kind === "xlsx" || looksLikeZip(input.bytes)) {
    try {
      const grid = xlsxBytesToGrid(input.bytes);
      const parsed = safeGridParse(grid, notes);
      if (parsed) push(toCandidate("planilha", parsed, ["Lido como Excel/OpenXML."]));
      const asText = grid.map((row) => row.join("\t")).join("\n");
      push(toCandidate("texto_livre", extractCustomersFromLooseText(asText)));
      const ai = await tryAiText(asText, notes);
      push(ai);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Falha ao abrir planilha.");
    }
  }

  if (kind === "csv_text" || kind === "unknown") {
    const text = decodeText(input.bytes);
    const grid = textToGrid(text);
    const structured = safeGridParse(grid, notes);
    if (structured) {
      push(toCandidate("texto_estruturado", structured, ["Lido como CSV/texto tabular."]));
    }
    push(toCandidate("texto_livre", extractCustomersFromLooseText(text)));
    const bestSoFar = pickBestCandidate(candidates);
    if (!bestSoFar || bestSoFar.confidence < 45 || bestSoFar.rows.length < 3) {
      push(await tryAiText(text, notes));
    }
  }

  if (kind === "pdf") {
    try {
      const { text, pages } = await extractPdfPlainText(input.bytes);
      notes.push(`PDF com ${pages} página(s).`);
      if (text.length >= 12) {
        const grid = textToGrid(text);
        const structured = safeGridParse(grid, notes);
        if (structured) {
          push(toCandidate("pdf_texto", structured, ["PDF com texto tabular."]));
        }
        push(toCandidate("texto_livre", extractCustomersFromLooseText(text), ["PDF lido em texto livre."]));
        const bestSoFar = pickBestCandidate(candidates);
        if (!bestSoFar || bestSoFar.confidence < 50) {
          push(await tryAiText(text, notes));
        }
      } else {
        notes.push("PDF quase sem texto (possível scan).");
        if (isImportAiReady()) {
          // Sem render de página no serverless: pede foto OU usa IA no pouco texto.
          push(await tryAiText(text || "PDF scan sem texto extraível.", notes));
          notes.push(
            "Scan: para melhor leitura, envie também um print/foto da lista ou um CSV do cardápio digital.",
          );
        } else {
          throw new Error(
            "Este PDF parece digitalizado (sem texto). Envie CSV/Excel, ou configure OPENAI_API_KEY e envie um print da lista.",
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("digitalizado")) throw error;
      notes.push(error instanceof Error ? error.message : "Falha ao ler PDF.");
      if (isImportAiReady()) {
        push(await tryAiText(decodeText(input.bytes).slice(0, 4000), notes));
      }
    }
  }

  if (kind === "image") {
    const mime =
      input.mime && input.mime.startsWith("image/")
        ? input.mime
        : input.filename.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg";
    if (!isImportAiReady()) {
      throw new Error(
        "Para ler foto/print da lista, configure OPENAI_API_KEY (ou CUSTOMER_IMPORT_AI_KEY) na Vercel/.env.local.",
      );
    }
    push(
      await tryAiVision({
        mime,
        bytes: input.bytes,
        notes,
        hint: "Imagem de lista de clientes / export do cardápio digital. Extrai nome e telefone de cada pessoa.",
      }),
    );
  }

  const best = pickBestCandidate(candidates);
  if (!best) {
    const hint = notes.filter(Boolean).slice(0, 3).join(" ");
    throw new Error(
      hint ||
        "Não consegui interpretar clientes (nome + WhatsApp) neste ficheiro. Tente CSV, Excel, PDF com texto ou um print com IA configurada.",
    );
  }

  const result: ImportAgentResult = {
    kind,
    method: best.method,
    confidence: best.confidence,
    rows: best.rows,
    invalid: best.invalid,
    rejected: best.rejected,
    notes: [...best.notes, ...notes].filter(Boolean).slice(0, 8),
    aiUsed,
    previewLabel: "",
  };
  result.previewLabel = previewLabel(result);
  return result;
}
