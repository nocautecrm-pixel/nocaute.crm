import {
  CONFIRM_BUTTON_TEXT,
  CONFIRM_OPTIN_PAYLOAD,
  CONTINUE_BUTTON_TEXT,
  CONTINUE_OFFER_PAYLOAD,
  STOP_OFFERS_BUTTON_TEXT,
  STOP_OFFERS_PAYLOAD,
} from "@/lib/whatsapp/constants";

export type MetaInboundMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
  };
  context?: { id?: string; from?: string };
};

export type MetaChangeValue = {
  metadata?: { phone_number_id?: string };
  statuses?: Array<{ id: string; status: string; errors?: Array<{ code?: number }> }>;
  messages?: MetaInboundMessage[];
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ value?: MetaChangeValue }>;
  }>;
};

function normalize(value?: string) {
  return (value ?? "").trim();
}

export function getButtonClick(message: MetaInboundMessage) {
  const payload = normalize(message.button?.payload ?? message.interactive?.button_reply?.id);
  const text = normalize(message.button?.text ?? message.interactive?.button_reply?.title);
  const typed = normalize(message.text?.body);
  return { payload, text, typed };
}

function matchesAny(candidates: string[], accepted: string[]) {
  return candidates.some((value) => {
    const upper = value.toUpperCase();
    return accepted.some((item) => upper === item.toUpperCase());
  });
}

/** Cliente tocou Continuar (ou Confirmar no template legado). */
export function isContinueOfferClick(message: MetaInboundMessage) {
  const { payload, text, typed } = getButtonClick(message);
  return matchesAny([payload, text, typed], [
    CONTINUE_OFFER_PAYLOAD,
    CONTINUE_BUTTON_TEXT,
    CONFIRM_OPTIN_PAYLOAD,
    CONFIRM_BUTTON_TEXT,
  ]);
}

/** @deprecated use isContinueOfferClick */
export function isConfirmOptInClick(message: MetaInboundMessage) {
  return isContinueOfferClick(message);
}

/** Cliente tocou Não receber oferta — opt-out e silêncio. */
export function isStopOffersClick(message: MetaInboundMessage) {
  const { payload, text, typed } = getButtonClick(message);
  return matchesAny([payload, text, typed], [
    STOP_OFFERS_PAYLOAD,
    STOP_OFFERS_BUTTON_TEXT,
    "NAO RECEBER OFERTA",
    "NÃO RECEBER OFERTA",
  ]);
}

export function parseWebhookPayload(rawBody: string): MetaWebhookPayload {
  return JSON.parse(rawBody) as MetaWebhookPayload;
}
