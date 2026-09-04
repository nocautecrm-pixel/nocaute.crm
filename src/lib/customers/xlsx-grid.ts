import { inflateRawSync } from "zlib";

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
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error("Arquivo Excel inválido.");
  const count = u16(bytes, eocd + 10);
  let offset = u32(bytes, eocd + 16);
  const files = new Map<string, Uint8Array>();

  for (let i = 0; i < count; i += 1) {
    if (u32(bytes, offset) !== 0x02014b50) break;
    const method = u16(bytes, offset + 10);
    const compressedSize = u32(bytes, offset + 20);
    const nameLen = u16(bytes, offset + 28);
    const extraLen = u16(bytes, offset + 30);
    const commentLen = u16(bytes, offset + 32);
    const localOffset = u32(bytes, offset + 42);
    const name = decodeUtf8(bytes.slice(offset + 46, offset + 46 + nameLen));
    const localNameLen = u16(bytes, localOffset + 26);
    const localExtraLen = u16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) content = new Uint8Array(inflateRawSync(Buffer.from(compressed)));
    else throw new Error("Arquivo Excel com compressão não suportada.");
    files.set(name, content);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function colFromRef(ref: string) {
  const letters = /[A-Za-z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string) {
  const items: string[] = [];
  const blocks = xml.match(/<(?:\w+:)?si\b[\s\S]*?<\/(?:\w+:)?si>/gi) ?? [];
  for (const block of blocks) {
    const texts = [...block.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi)];
    items.push(xmlText(texts.map((match) => match[1] ?? "").join("")));
  }
  return items;
}

function parseSheet(xml: string, shared: string[]) {
  const rows: string[][] = [];
  const rowBlocks = xml.match(/<(?:\w+:)?row\b[\s\S]*?<\/(?:\w+:)?row>/gi) ?? [];
  for (const rowXml of rowBlocks) {
    const cells = [...rowXml.matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/gi)];
    if (cells.length === 0) continue;
    const line: string[] = [];
    for (const cell of cells) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      const ref = /r="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const col = colFromRef(ref);
      let value = "";
      if (type === "s") {
        const index = Number(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i.exec(body)?.[1] ?? "");
        value = shared[index] ?? "";
      } else if (type === "inlineStr") {
        const text = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/i.exec(body)?.[1] ?? "";
        value = xmlText(text);
      } else {
        value = xmlText(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i.exec(body)?.[1] ?? "").trim();
      }
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
