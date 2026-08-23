export type ChatbotTone = "descontraido" | "objetivo" | "premium" | "formal";
export type ChatbotDetailLevel = "curto" | "medio" | "completo";

export type BrandDna = {
  personality: string;
  tone: ChatbotTone;
  detailLevel: ChatbotDetailLevel;
  emojis: boolean;
  greeting: string;
};

export const DEFAULT_BRAND_DNA: BrandDna = {
  personality: "Atendente da casa, cordial e direto",
  tone: "descontraido",
  detailLevel: "medio",
  emojis: true,
  greeting: "Oi! Aqui é da casa",
};

export const PREVIEW_PROMPTS = [
  { id: "hours", customer: "Oi, vocês abrem hoje?" },
  { id: "coupon", customer: "Tem cupom?" },
  { id: "menu", customer: "Quero ver o cardápio" },
] as const;

export type StoreFacts = {
  hoursText?: string;
  menuUrl?: string;
  address?: string;
};

function hoursReply(facts: StoreFacts | undefined, level: ChatbotDetailLevel) {
  const hours = facts?.hoursText?.trim();
  if (!hours) {
    return level === "curto"
      ? "Ainda não cadastrei o horário da casa neste painel. Confira no Instagram ou ligue para o salão."
      : "Ainda não tenho o horário oficial cadastrado. Peça no salão ou olhe o perfil da loja — não invento expediente.";
  }
  if (level === "curto") return `Horário: ${hours}`;
  return `Nosso horário cadastrado: ${hours}. Se for feriado, confirme no salão.`;
}

function menuReply(facts: StoreFacts | undefined, level: ChatbotDetailLevel) {
  const menu = facts?.menuUrl?.trim();
  const address = facts?.address?.trim();
  if (menu) {
    return level === "curto" ? `Cardápio: ${menu}` : `O cardápio está aqui: ${menu}${address ? ` · ${address}` : ""}`;
  }
  return "Ainda não tem link de cardápio no perfil da loja. Peça no salão para não te mandar um cardápio velho.";
}

function couponReply(level: ChatbotDetailLevel) {
  if (level === "curto") return "Cupom só vale o código que chegou neste WhatsApp. Mostre no caixa.";
  return "Cupom oficial só o que esta loja enviou neste WhatsApp. Mostre o código no caixa. Não invento promoção.";
}

function detectIntent(message: string) {
  const text = message.toLowerCase();
  if (/(abert|hor[aá]rio|hoje|funciona)/.test(text)) return "hours" as const;
  if (/(cupom|desconto|promo|oferta)/.test(text)) return "coupon" as const;
  if (/(salad|card[aá]pio|leve|comer|pedido|menu)/.test(text)) return "menu" as const;
  return "fallback" as const;
}

function toneWrap(text: string, tone: ChatbotTone, storeName: string) {
  if (tone === "formal") {
    return `Olá, obrigado por falar com a ${storeName}. ${text}`;
  }
  if (tone === "premium") {
    return `${text} Com carinho, ${storeName}.`;
  }
  if (tone === "objetivo") {
    return text.replace(/\s+/g, " ").trim();
  }
  return text;
}

function withPersonality(text: string, personality: string) {
  const flavor = personality.trim();
  if (!flavor) return text;
  if (/(direto|objetivo)/i.test(flavor)) {
    return text.replace(/Se quiser, /g, "").replace(/com calma/g, "");
  }
  return text;
}

function stripEmojis(text: string) {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function withEmojis(text: string, enabled: boolean, intent: "hours" | "coupon" | "menu" | "fallback") {
  if (!enabled) return stripEmojis(text);
  const mark =
    intent === "hours" ? "" : intent === "coupon" ? "" : intent === "menu" ? "" : "";
  return `${text}${mark}`;
}

function withGreeting(text: string, greeting: string, emojis: boolean) {
  const line = greeting.trim();
  if (!line) return text;
  const safe = emojis ? line : stripEmojis(line);
  if (!safe) return text;
  if (text.startsWith(safe)) return text;
  return `${safe}. ${text}`;
}

export function composeChatbotReply(input: {
  dna: BrandDna;
  storeName: string;
  customerMessage: string;
  facts?: StoreFacts;
}) {
  const intent = detectIntent(input.customerMessage);
  const base =
    intent === "hours"
      ? hoursReply(input.facts, input.dna.detailLevel)
      : intent === "coupon"
        ? couponReply(input.dna.detailLevel)
        : intent === "menu"
          ? menuReply(input.facts, input.dna.detailLevel)
          : input.dna.detailLevel === "curto"
            ? "Recebi. Posso ajudar com cardápio, horário ou cupom."
            : "Recebi sua mensagem. Posso ajudar com cardápio, horário cadastrado da casa ou um cupom que já chegou neste WhatsApp.";
  const flavored = withPersonality(base, input.dna.personality);
  const toned = toneWrap(flavored, input.dna.tone, input.storeName);
  const greeted = withGreeting(toned, input.dna.greeting, input.dna.emojis);
  return withEmojis(greeted, input.dna.emojis, intent);
}

export function applyBrandDnaToCopy(copy: string, dna: BrandDna) {
  let text = copy.trim();
  if (!dna.emojis) {
    text = stripEmojis(text);
  }
  if (dna.detailLevel === "curto") {
    const first = text.split(/\n\n/)[0] ?? text;
    text = first.length > 220 ? `${first.slice(0, 217).trim()}…` : first;
  }
  const signOff = dna.greeting.trim();
  if (signOff && !text.includes(signOff)) {
    const safe = dna.emojis ? signOff : stripEmojis(signOff);
    if (safe) text = `${text}\n\n${safe}`;
  }
  return text;
}

export function previewConversation(dna: BrandDna, storeName: string, facts?: StoreFacts) {
  return PREVIEW_PROMPTS.map((item) => ({
    id: item.id,
    customer: item.customer,
    bot: composeChatbotReply({
      dna,
      storeName,
      customerMessage: item.customer,
      facts,
    }),
  }));
}
