import { createHmac, timingSafeEqual } from "crypto";

export type MetaSignedPayload = {
  algorithm?: string;
  expires?: number;
  issued_at?: number;
  user_id?: string;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaSignedPayload {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) {
    throw new Error("signed_request inválido.");
  }

  const sig = base64UrlDecode(encodedSig);
  const expected = createHmac("sha256", appSecret).update(payload).digest();

  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    throw new Error("Assinatura do signed_request inválida.");
  }

  const data = JSON.parse(base64UrlDecode(payload).toString("utf8")) as MetaSignedPayload;
  if (data.algorithm && data.algorithm.toUpperCase() !== "HMAC-SHA256") {
    throw new Error("Algoritmo de assinatura não suportado.");
  }
  if (data.expires && data.expires * 1000 < Date.now()) {
    throw new Error("signed_request expirado.");
  }

  return data;
}
