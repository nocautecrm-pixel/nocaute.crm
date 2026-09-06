import { extractTextItems, getDocumentProxy } from "unpdf";

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Reconstrói linhas do PDF pela posição (Y/X), não pela ordem bagunçada do extractText. */
export async function extractPdfLayoutText(bytes: Uint8Array): Promise<{
  text: string;
  pages: number;
  plainFallback: string;
}> {
  const pdf = await getDocumentProxy(bytes);
  const pages = pdf.numPages;
  if (pages > 40) {
    throw new Error("PDF com mais de 40 páginas. Exporte só a lista de clientes ou um CSV.");
  }

  const { items } = await extractTextItems(pdf);
  const pageBlocks: string[] = [];

  for (const pageItems of items) {
    const usable = (pageItems as TextItem[]).filter((item) => item.str?.trim());
    if (usable.length === 0) {
      pageBlocks.push("");
      continue;
    }

    // PDF origin is bottom-left; sort top→bottom, then left→right.
    const sorted = [...usable].sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 3) return dy;
      return a.x - b.x;
    });

    const lines: TextItem[][] = [];
    for (const item of sorted) {
      const current = lines[lines.length - 1];
      if (!current) {
        lines.push([item]);
        continue;
      }
      const avgY = current.reduce((sum, cell) => sum + cell.y, 0) / current.length;
      const avgH =
        current.reduce((sum, cell) => sum + (cell.height || 8), 0) / current.length || 8;
      if (Math.abs(item.y - avgY) <= Math.max(3, avgH * 0.45)) {
        current.push(item);
      } else {
        lines.push([item]);
      }
    }

    const pageText = lines
      .map((line) => {
        const ordered = [...line].sort((a, b) => a.x - b.x);
        const parts: string[] = [];
        let lastRight = -Infinity;
        for (const cell of ordered) {
          const gap = cell.x - lastRight;
          if (parts.length > 0 && gap > 12) {
            // Espaço grande ≈ nova coluna (útil para CSV mental / IA).
            parts.push("\t");
          } else if (parts.length > 0 && gap > 2) {
            parts.push(" ");
          }
          parts.push(cell.str.trim());
          lastRight = cell.x + (cell.width || 0);
        }
        return parts
          .join("")
          .replace(/\t+/g, "\t")
          .replace(/[ ]+/g, " ")
          .trim();
      })
      .filter(Boolean)
      .join("\n");

    pageBlocks.push(pageText);
  }

  const text = pageBlocks.filter(Boolean).join("\n\n").trim();
  const plainFallback = pageBlocks.join("\n").trim();
  return { text: text || plainFallback, pages, plainFallback };
}
