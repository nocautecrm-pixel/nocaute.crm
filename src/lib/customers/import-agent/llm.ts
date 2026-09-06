import { normalizeOptInSource, type OptInSource } from "@/lib/customers/opt-in";
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
    const optInSource = item.optInSource ? normalizeOptInSource(String(item.optInSource)) : null;
    const optInProof = item.optInProof ? String(item.optInProof).trim() || null : null;
    const optIn = Boolean(item.optIn && optInSource && optInProof);

    collected.push({
      name: name.length >= 2 ? name : `Cliente ${phone.slice(-4)}`,
      phone,
      lastPurchaseAt,
      orderCount,
      optIn,
      optInAt: optIn ? lastPurchaseAt ?? new Date().toISOString() : null,
      optInSource: optIn ? (optInSource as OptInSource) : null,
      optInProof: optIn ? optInProof : null,
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

const SYSTEM_PROMPT = `És um agent de importação de base de CLIENTES de restaurante (WhatsApp CRM).
Extrai só pessoas com telefone (WhatsApp/celular). Ignora itens de cardápio, preços, CNPJ, endereço da loja, cabeçalhos e rodapés.
O texto pode vir de PDF com colunas separadas por TAB — trata cada linha como possível registo (nome + telefone na mesma linha ou em colunas vizinhas).
Se o ficheiro for cardápio de produtos (pratos/preços sem telefones de clientes), devolve customers: [].
Telefones brasileiros: preserve DDD; normaliza mentalmente para E.164 (+55...).
Não inventes telefones. Se o nome estiver partido em colunas, junta.
Responde APENAS JSON:
{"documentType":"customers"|"menu"|"mixed"|"unknown","customers":[{"name":"...","phone":"...","lastPurchaseAt":null,"daysAgo":null,"orderCount":null,"optIn":false,"optInSource":null,"optInProof":null}]}`;

async function callChat(messages: unknown[]) {
  const response = await fetch(`${aiBaseUrl().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `IA falhou (${response.status})`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("IA sem resposta.");
  const parsed = extractJsonObject(content) as {
    documentType?: string;
    customers?: AiRow[];
  };
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
  const clipped = text.length > 60_000 ? `${text.slice(0, 60_000)}\n…[cortado]` : text;
  return callChat([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Interpreta este export e extrai clientes:\n\n${clipped}`,
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
