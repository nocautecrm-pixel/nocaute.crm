import { detectImportKind } from "@/lib/customers/import-agent/detect";
import { extractCustomersFromLooseText } from "@/lib/customers/import-agent/loose-text";
import {
  extractCustomersWithAiText,
  extractCustomersWithAiVision,
  isImportAiReady,
  bytesToBase64,
} from "@/lib/customers/import-agent/llm";
import { extractPdfLayoutText } from "@/lib/customers/import-agent/pdf-layout";
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
    pdf_texto: "PDF (layout + interpretação)",
    ia_texto: "IA no texto do ficheiro",
    ia_visao: "IA visual (imagem/scan)",
  };
  return `${methodLabels[result.method] ?? result.method} · ${result.rows.length} contacto(s) · confiança ${result.confidence}`;
}

function boost(candidate: ImportCandidate | null, extra: number): ImportCandidate | null {
  if (!candidate) return null;
  return {
    ...candidate,
    confidence: Math.min(99, candidate.confidence + extra),
  };
}

async function tryAiText(text: string, notes: string[]): Promise<ImportCandidate | null> {
  if (!isImportAiReady() || text.trim().length < 12) return null;
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

function pickForPdf(candidates: ImportCandidate[]): ImportCandidate | null {
  const usable = candidates.filter((item) => item.rows.length > 0);
  if (usable.length === 0) return null;
  // Em PDF, preferir IA quando existir — o layout visual/textual costuma vencer o parser cego.
  const ai = usable
    .filter((item) => item.method === "ia_texto" || item.method === "ia_visao")
    .sort((a, b) => b.rows.length - a.rows.length || b.confidence - a.confidence)[0];
  if (ai && ai.rows.length >= 1) return ai;
  return pickBestCandidate(usable);
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
      if (!parsed || parsed.rows.length < 3 || parsed.invalid > parsed.rows.length) {
        push(await tryAiText(asText, notes));
      }
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
      let layoutText = "";
      let pages = 0;
      try {
        const layout = await extractPdfLayoutText(input.bytes);
        layoutText = layout.text;
        pages = layout.pages;
        notes.push(`PDF com ${pages} página(s) · layout por coordenadas.`);
      } catch (layoutError) {
        notes.push(
          layoutError instanceof Error
            ? `Layout PDF: ${layoutError.message}`
            : "Layout PDF falhou.",
        );
      }

      if (!layoutText || layoutText.length < 12) {
        const plain = await extractPdfPlainText(input.bytes);
        pages = plain.pages;
        layoutText = plain.text;
        notes.push(`PDF fallback texto simples · ${pages} página(s).`);
      }

      if (layoutText.length >= 12) {
        const grid = textToGrid(layoutText.replace(/\t/g, ";"));
        const structured = safeGridParse(grid, notes);
        if (structured) {
          push(toCandidate("pdf_texto", structured, ["PDF reconstruído em colunas."]));
        }
        push(
          toCandidate("texto_livre", extractCustomersFromLooseText(layoutText), [
            "PDF: caça a telefones no layout.",
          ]),
        );
        // Sempre tenta IA no PDF (texto de layout) — é o que mais acerta export feio.
        push(boost(await tryAiText(layoutText, notes), 22));
      } else {
        notes.push("PDF quase sem texto (possível scan).");
        if (!isImportAiReady()) {
          throw new Error(
            "Este PDF parece digitalizado (sem texto). Configure OPENAI_API_KEY e envie de novo, ou mande um print/CSV da lista.",
          );
        }
        push(boost(await tryAiText("PDF scan sem texto extraível.", notes), 10));
        notes.push("Sem texto no PDF: envie também um print da lista para a IA visual.");
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes("digitalizado") || error.message.includes("40 páginas"))) {
        throw error;
      }
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

  const best = kind === "pdf" ? pickForPdf(candidates) : pickBestCandidate(candidates);
  if (!best) {
    const hint = notes.filter(Boolean).slice(0, 3).join(" ");
    const aiHint = !isImportAiReady()
      ? " Sem OPENAI_API_KEY a leitura de PDF difícil fica limitada — configure na Vercel."
      : "";
    throw new Error(
      (hint ||
        "Não consegui interpretar clientes (nome + WhatsApp) neste ficheiro. Tente CSV, Excel, PDF ou um print.") +
        aiHint,
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
