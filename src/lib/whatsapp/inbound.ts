import {
  CONFIRM_BUTTON_TEXT,
  CONFIRM_OPTIN_PAYLOAD,
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

export function isConfirmOptInClick(message: MetaInboundMessage) {
  const { payload, text, typed } = getButtonClick(message);
  const candidates = [payload, text, typed];
  return candidates.some((value) => {
    const upper = value.toUpperCase();
    return (
      upper === CONFIRM_OPTIN_PAYLOAD ||
      upper === CONFIRM_BUTTON_TEXT.toUpperCase() ||
      upper === "CONFIRMAR"
    );
  });
}

export function parseWebhookPayload(rawBody: string): MetaWebhookPayload {
  return JSON.parse(rawBody) as MetaWebhookPayload;
}
