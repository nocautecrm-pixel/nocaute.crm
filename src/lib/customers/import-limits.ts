export const IMPORT_LIMITS = {
  bytes: 8_000_000,
  expandedBytes: 16_000_000,
  entryBytes: 8_000_000,
  entries: 256,
  rows: 5_012,
  customers: 5_000,
  columns: 100,
  cells: 150_000,
  cellChars: 10_000,
  sharedStrings: 50_000,
} as const;

export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Conteúdo acima do limite permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
