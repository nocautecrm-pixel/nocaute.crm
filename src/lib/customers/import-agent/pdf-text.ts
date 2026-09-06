import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfPlainText(bytes: Uint8Array): Promise<{
  text: string;
  pages: number;
}> {
  const pdf = await getDocumentProxy(bytes);
  const pages = pdf.numPages;
  if (pages > 40) {
    throw new Error("PDF com mais de 40 páginas. Exporte só a lista de clientes ou um CSV.");
  }
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return { text: merged.trim(), pages };
}
