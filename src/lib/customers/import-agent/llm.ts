import { z } from "zod";
import { readBoundedBody } from "@/lib/customers/import-limits";
import { withImportBudget } from "@/server/compliance/import-budget";
import {
  lastPurchaseFromDaysAgo,
  parseDate,
  type ParseCustomerResult,
  type ParsedCustomerRow,
} from "@/lib/customers/parse-sheet";
import { normalizeToE164 } from "@/lib/whatsapp/phone";

type AiRow = {
  name?: string;
  phone?: string;
  lastPurchaseAt?: string | null;
  daysAgo?: number | null;
  orderCount?: number | null;
  optIn?: boolean;
  optInSource?: string | null;
  optInProof?: string | null;
};

function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.CUSTOMER_IMPORT_AI_KEY?.trim());
}

function aiKey() {
  return process.env.CUSTOMER_IMPORT_AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

function aiBaseUrl() {
  return (
    process.env.CUSTOMER_IMPORT_AI_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  );
}

function aiModel() {
  return process.env.CUSTOMER_IMPORT_AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function isImportAiReady() {
  return aiConfigured();
}

function normalizeAiRows(raw: AiRow[]): ParseCustomerResult {
  const collected: ParsedCustomerRow[] = [];
  let invalid = 0;
  const rejected: string[] = [];

  for (const item of raw) {
    const phone = normalizeToE164(String(item.phone ?? ""));
    if (!phone) {
      invalid += 1;
      if (item.phone) rejected.push(`IA: telefone inválido (${String(item.phone).slice(0, 24)})`);
      continue;
    }
    const name = String(item.name ?? "").trim();
    const daysAgo =
      typeof item.daysAgo === "number" && Number.isFinite(item.daysAgo)
        ? Math.floor(item.daysAgo)
        : null;
    const lastPurchaseAt =
      (item.lastPurchaseAt ? parseDate(String(item.lastPurchaseAt)) : null) ??
      (daysAgo !== null && daysAgo >= 0 ? lastPurchaseFromDaysAgo(daysAgo) : null);
    const orderCount =
      typeof item.orderCount === "number" && Number.isFinite(item.orderCount)
        ? Math.max(0, Math.floor(item.orderCount))
        : null;

    collected.push({
      name: name.length >= 2 ? name : `Cliente ${phone.slice(-4)}`,
      phone,
      lastPurchaseAt,
      orderCount,
      optIn: false,
      optInAt: null,
      optInSource: null,
      optInProof: null,
    });
  }

  const byPhone = new Map<string, ParsedCustomerRow>();
  for (const row of collected) {
    byPhone.set(row.phone, row);
  }

  return { rows: [...byPhone.values()], invalid, rejected: rejected.slice(0, 8) };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("IA não devolveu JSON utilizável.");
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

const SYSTEM_PROMPT = `És um agent de importação de CLIENTES para CRM de restaurante (WhatsApp).
Extrai UMA linha por pessoa. Campos:
- name (nome do cliente)
- phone (WhatsApp/celular com DDD)
- orderCount (quantos pedidos já fez; número ou null)
- daysAgo (há quantos dias não pede; número ou null)
- lastPurchaseAt (data da última compra se existir; senão null)

Ignora cardápio, preços, CNPJ da loja, cabeçalhos e rodapés.
Não inventes telefones. Não resumas a lista num único cliente — devolve TODOS.
Responde APENAS JSON:
{"documentType":"customers"|"menu"|"mixed"|"unknown","customers":[{"name":"...","phone":"...","orderCount":null,"daysAgo":null,"lastPurchaseAt":null,"optIn":false,"optInSource":null,"optInProof":null}]}`;

async function callChat(messages: unknown[]) {
  return withImportBudget("ai", () => performChat(messages));
}

async function performChat(messages: unknown[]) {
  const requestBody = JSON.stringify({
    model: aiModel(), temperature: 0, max_tokens: 4096,
    response_format: { type: "json_object" }, messages,
  });
  if (Buffer.byteLength(requestBody) > 11_000_000) throw new Error("Entrada de IA acima do limite.");
  const response = await fetch(`${aiBaseUrl().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey()}`,
      "Content-Type": "application/json",
    },
    body: requestBody,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = JSON.parse(new TextDecoder().decode(await readBoundedBody(response.body, 256_000))) as {
    error?: { message?: string };
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `IA falhou (${response.status})`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA sem resposta.");
  if (payload.choices?.[0]?.finish_reason === "length") throw new Error("Lista grande demais para IA; envie CSV/Excel.");
  const parsed = z.object({
    documentType: z.enum(["customers", "menu", "mixed", "unknown"]).optional(),
    customers: z.array(z.object({
      name: z.string().max(256).optional(), phone: z.string().max(40).optional(),
      lastPurchaseAt: z.string().max(40).nullable().optional(),
      daysAgo: z.number().finite().nullable().optional(), orderCount: z.number().finite().nullable().optional(),
    })).max(5000),
  }).parse(extractJsonObject(content));
  if (parsed.documentType === "menu" && (!parsed.customers || parsed.customers.length === 0)) {
    throw new Error(
      "Isto parece cardápio/produtos, não lista de clientes. Envie a base de clientes (nome + WhatsApp).",
    );
  }
  return normalizeAiRows(Array.isArray(parsed.customers) ? parsed.customers : []);
}

export async function extractCustomersWithAiText(text: string): Promise<ParseCustomerResult> {
  if (!aiConfigured()) {
    throw new Error("IA de importação não configurada (OPENAI_API_KEY).");
  }
  if (text.length > 60_000) throw new Error("Texto grande demais para IA; envie CSV/Excel.");
  return callChat([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Interpreta este export e extrai clientes:\n\n${text}`,
    },
  ]);
}

export async function extractCustomersWithAiVision(input: {
  mime: string;
  base64: string;
  hint?: string;
}): Promise<ParseCustomerResult> {
  if (!aiConfigured()) {
    throw new Error("IA de importação não configurada (OPENAI_API_KEY).");
  }
  return callChat([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            input.hint ??
            "Lê esta imagem/página (print, PDF scan ou export visual) e extrai a lista de clientes com telefone.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${input.mime};base64,${input.base64}` },
        },
      ],
    },
  ]);
}

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}
