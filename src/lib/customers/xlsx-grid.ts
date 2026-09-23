import { inflateRawSync } from "zlib";
import { IMPORT_LIMITS as LIMIT } from "@/lib/customers/import-limits";

function bounded(bytes: Uint8Array, offset: number, length: number) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error("Arquivo Excel truncado ou inválido.");
  }
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function findEocd(bytes: Uint8Array) {
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function unzip(bytes: Uint8Array) {
  if (bytes.length > LIMIT.bytes) throw new Error("Arquivo acima de 8 MB.");
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error("Arquivo Excel inválido.");
  const count = u16(bytes, eocd + 10);
  if (count > LIMIT.entries || u16(bytes, eocd + 4) !== 0 || u16(bytes, eocd + 6) !== 0) throw new Error("Arquivo Excel com entradas demais ou formato não suportado.");
  let offset = u32(bytes, eocd + 16);
  const directoryEnd = offset + u32(bytes, eocd + 12);
  bounded(bytes, offset, directoryEnd - offset);
  if (directoryEnd > eocd) throw new Error("Diretório Excel inválido.");
  const files = new Map<string, Uint8Array>();
  let expanded = 0;

  for (let i = 0; i < count; i += 1) {
    bounded(bytes, offset, 46);
    if (u32(bytes, offset) !== 0x02014b50) throw new Error("Diretório Excel inválido.");
    if (u16(bytes, offset + 8) & 1) throw new Error("Excel protegido por senha não suportado.");
    const method = u16(bytes, offset + 10);
    const compressedSize = u32(bytes, offset + 20);
    const expandedSize = u32(bytes, offset + 24);
    const nameLen = u16(bytes, offset + 28);
    const extraLen = u16(bytes, offset + 30);
    const commentLen = u16(bytes, offset + 32);
    const localOffset = u32(bytes, offset + 42);
    bounded(bytes, offset + 46, nameLen + extraLen + commentLen);
    if (offset + 46 + nameLen + extraLen + commentLen > directoryEnd) throw new Error("Diretório Excel inválido.");
    const name = decodeUtf8(bytes.slice(offset + 46, offset + 46 + nameLen));
    if (files.has(name)) throw new Error("Excel com entradas duplicadas.");
    bounded(bytes, localOffset, 30);
    if (u32(bytes, localOffset) !== 0x04034b50) throw new Error("Entrada Excel inválida.");
    const localNameLen = u16(bytes, localOffset + 26);
    const localExtraLen = u16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    bounded(bytes, dataStart, compressedSize);
    if (dataStart + compressedSize > u32(bytes, eocd + 16)) throw new Error("Entrada Excel sobreposta ao diretório.");
    const available = Math.min(LIMIT.entryBytes, LIMIT.expandedBytes - expanded);
    if (available <= 0 || expandedSize > available) throw new Error("Excel descompactado acima do limite.");
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) content = new Uint8Array(inflateRawSync(compressed, { maxOutputLength: available }));
    else throw new Error("Arquivo Excel com compressão não suportada.");
    if (content.length > available || content.length !== expandedSize) throw new Error("Tamanho de entrada Excel inválido.");
    expanded += content.length;
    files.set(name, content);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlText(value: string) {
  if (value.length > LIMIT.cellChars * 10) throw new Error("Texto de célula acima do limite.");
  const chunks: string[] = [];
  let cursor = 0;
  for (let start = value.indexOf("<![CDATA["); start >= 0; start = value.indexOf("<![CDATA[", cursor)) {
    const end = value.indexOf("]]>", start + 9);
    if (end < 0) throw new Error("XML do Excel incompleto.");
    chunks.push(value.slice(cursor, start), value.slice(start + 9, end));
    cursor = end + 3;
  }
  chunks.push(value.slice(cursor));
  return chunks.join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function colFromRef(ref: string) {
  const match = /^([A-Za-z]{1,3})[1-9][0-9]{0,6}$/.exec(ref);
  if (!match) throw new Error("Referência de célula inválida.");
  const letters = match[1];
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  if (n > LIMIT.columns) throw new Error("Planilha acima de 100 colunas.");
  return n - 1;
}

// Advance past each element exactly once. Lazy whole-document regexes can
// repeatedly scan malformed XML with thousands of unclosed opening tags.
function* xmlElements(xml: string, tag: string, limit: number) {
  const open = new RegExp(`<((?:[A-Za-z_][\\w.-]*:)?${tag})\\b([^<>]{0,2048})>`, "g");
  let count = 0;
  for (let match = open.exec(xml); match; match = open.exec(xml)) {
    if (++count > limit) throw new Error("Excel com elementos demais.");
    const attrs = match[2];
    if (attrs.endsWith("/")) { yield { attrs, body: "" }; continue; }
    const close = `</${match[1]}>`;
    const end = xml.indexOf(close, open.lastIndex);
    if (end < 0) throw new Error("XML do Excel incompleto.");
    const body = xml.slice(open.lastIndex, end);
    open.lastIndex = end + close.length;
    yield { attrs, body };
  }
}

function parseSharedStrings(xml: string) {
  const items: string[] = [];
  for (const block of xmlElements(xml, "si", LIMIT.sharedStrings)) {
    const texts = [...xmlElements(block.body, "t", 1000)];
    const value = xmlText(texts.map((text) => text.body).join(""));
    if (value.length > LIMIT.cellChars) throw new Error("Texto de célula acima do limite.");
    items.push(value);
  }
  return items;
}

function parseSheet(xml: string, shared: string[]) {
  const rows: string[][] = [];
  let rowCount = 0;
  let cellCount = 0;
  const rowBlocks = xmlElements(xml, "row", LIMIT.rows);
  for (const row of rowBlocks) {
    if (++rowCount > LIMIT.rows) throw new Error("Planilha com linhas demais.");
    const cells = xmlElements(row.body, "c", LIMIT.columns);
    const line: string[] = [];
    for (const cell of cells) {
      if (++cellCount > LIMIT.cells) throw new Error("Planilha com células demais.");
      const attrs = cell.attrs;
      const body = cell.body;
      if (body.length > LIMIT.cellChars * 10) throw new Error("Texto de célula acima do limite.");
      const ref = /r=["']([^"']+)["']/.exec(attrs)?.[1] ?? "";
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const col = ref ? colFromRef(ref) : line.length;
      if (col >= LIMIT.columns) throw new Error("Planilha acima de 100 colunas.");
      let value = "";
      if (type === "s") {
        const index = Number([...xmlElements(body, "v", 1)][0]?.body ?? "");
        value = shared[index] ?? "";
      } else if (type === "inlineStr") {
        const text = [...xmlElements(body, "t", 1000)].map((item) => item.body).join("");
        value = xmlText(text);
      } else {
        const raw = xmlText([...xmlElements(body, "v", 1)][0]?.body ?? "").trim();
        // Telefone em célula numérica / científica → dígitos inteiros.
        if (/^\d+(\.\d+)?e[+\-]?\d+$/i.test(raw)) {
          const asNumber = Number(raw);
          value = Number.isFinite(asNumber) ? Math.round(asNumber).toString() : raw;
        } else if (/^\d+\.\d+$/.test(raw) && raw.replace(/\D/g, "").length >= 10) {
          value = raw.split(".")[0] ?? raw;
        } else {
          value = raw;
        }
      }
      if (value.length > LIMIT.cellChars) throw new Error("Texto de célula acima do limite.");
      while (line.length <= col) line.push("");
      line[col] = value.trim();
    }
    if (line.some((cell) => cell)) rows.push(line);
  }
  return rows;
}

export function xlsxBytesToGrid(bytes: Uint8Array): string[][] {
  const files = unzip(bytes);
  const sheetPath =
    [...files.keys()].find((name) => /^xl\/worksheets\/sheet1\.xml$/i.test(name)) ??
    [...files.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  if (!sheetPath) throw new Error("Não achei a aba da planilha no Excel.");
  const sharedPath = [...files.keys()].find((name) => /xl\/sharedstrings\.xml$/i.test(name));
  const shared = sharedPath ? parseSharedStrings(decodeUtf8(files.get(sharedPath)!)) : [];
  return parseSheet(decodeUtf8(files.get(sheetPath)!), shared);
}

export function looksLikeZip(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function looksLikeLegacyXls(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}
