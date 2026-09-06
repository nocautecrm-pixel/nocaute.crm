import { looksLikeLegacyXls, looksLikeZip } from "@/lib/customers/xlsx-grid";
import type { ImportFileKind } from "@/lib/customers/import-agent/types";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PDF_EXT = /\.pdf$/i;
const TEXT_EXT = /\.(csv|tsv|txt|text)$/i;

export function detectImportKind(input: {
  filename: string;
  mime?: string;
  bytes: Uint8Array;
}): ImportFileKind {
  const name = input.filename.toLowerCase();
  const mime = (input.mime ?? "").toLowerCase();

  if (looksLikeLegacyXls(input.bytes)) return "xlsx";
  if (looksLikeZip(input.bytes) || name.endsWith(".xlsx") || mime.includes("spreadsheet")) {
    return "xlsx";
  }
  if (
    PDF_EXT.test(name) ||
    mime === "application/pdf" ||
    (input.bytes[0] === 0x25 && input.bytes[1] === 0x50 && input.bytes[2] === 0x44 && input.bytes[3] === 0x46)
  ) {
    return "pdf";
  }
  if (IMAGE_EXT.test(name) || mime.startsWith("image/")) return "image";
  if (TEXT_EXT.test(name) || mime.startsWith("text/") || mime.includes("csv")) return "csv_text";

  // Heurística: muitos bytes imprimíveis → texto
  const sample = input.bytes.slice(0, Math.min(input.bytes.length, 800));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 192) {
      printable += 1;
    }
  }
  if (sample.length > 0 && printable / sample.length > 0.85) return "csv_text";

  return "unknown";
}
