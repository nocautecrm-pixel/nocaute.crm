import {
  CONTINUE_OFFER_PAYLOAD,
  DEFAULT_CTA_LABEL,
  OPTIN_TEMPLATE,
  RETURN_TEMPLATE,
  STOP_OFFERS_PAYLOAD,
} from "@/lib/whatsapp/constants";
import { toWhatsAppRecipient } from "@/lib/whatsapp/phone";

export type TemplateOptInPayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: Array<Record<string, unknown>>;
  };
};

export type MediaMessagePayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "image" | "video";
  image?: { link: string; caption?: string };
  video?: { link: string; caption?: string };
};

export type CtaUrlPayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "cta_url";
    header?: { type: "text"; text: string };
    body: { text: string };
    footer?: { type: "text"; text: string };
    action: {
      name: "cta_url";
      parameters: {
        display_text: string;
        url: string;
      };
    };
  };
};

export type TextMessagePayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: { preview_url: boolean; body: string };
};

export function buildTextPayload(to: string, body: string): TextMessagePayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppRecipient(to),
    type: "text",
    text: { preview_url: false, body: body.slice(0, 4096) },
  };
}

export function interpolateOfferText(
  template: string,
  vars: { loja: string; cupom: string; desconto: string },
) {
  return template
    .replace(/\{\{loja\}\}/g, vars.loja)
    .replace(/\{\{cupom\}\}/g, vars.cupom)
    .replace(/\{\{desconto\}\}/g, vars.desconto);
}

export function withCouponQuery(url: string, coupon: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.get("cupom")) {
      parsed.searchParams.set("cupom", coupon);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Slug dinâmico do botão URL (substitui {{1}} na URL registrada no template). */
export function buildTemplateUrlSlug(ctaUrl: string, couponCode?: string) {
  try {
    const parsed = new URL(ctaUrl.startsWith("http") ? ctaUrl : `https://${ctaUrl}`);
    if (couponCode && !parsed.searchParams.get("cupom")) {
      parsed.searchParams.set("cupom", couponCode);
    }
    return `${parsed.host}${parsed.pathname.replace(/^\//, "")}${parsed.search}`;
  } catch {
    const slug = ctaUrl.replace(/^https?:\/\//i, "");
    if (couponCode && !slug.includes("cupom=")) {
      return slug.includes("?") ? `${slug}&cupom=${couponCode}` : `${slug}?cupom=${couponCode}`;
    }
    return slug;
  }
}

/**
 * Etapa 1 — HSM aprovado com quick replies Continuar / Não receber oferta.
 */
export function buildOptInTemplatePayload(input: {
  to: string;
  establishmentName: string;
  templateName?: string;
  language?: string;
}): TemplateOptInPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppRecipient(input.to),
    type: "template",
    template: {
      name: input.templateName ?? OPTIN_TEMPLATE.name,
      language: { code: input.language ?? OPTIN_TEMPLATE.language },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: input.establishmentName }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [{ type: "payload", payload: CONTINUE_OFFER_PAYLOAD }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [{ type: "payload", payload: STOP_OFFERS_PAYLOAD }],
        },
      ],
    },
  };
}

/**
 * Template MARKETING com botão URL (legado / templates auxiliares).
 */
export function buildReturnTemplatePayload(input: {
  to: string;
  customerName: string;
  ctaUrl: string;
  couponCode?: string;
  templateName?: string;
  language?: string;
}): TemplateOptInPayload {
  const urlSlug = buildTemplateUrlSlug(input.ctaUrl, input.couponCode);
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppRecipient(input.to),
    type: "template",
    template: {
      name: input.templateName ?? RETURN_TEMPLATE.name,
      language: { code: input.language ?? RETURN_TEMPLATE.language },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: input.customerName }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: urlSlug }],
        },
      ],
    },
  };
}

/**
 * Etapa 2a — criativo (imagem ou vídeo) na janela de 24h após o clique.
 */
export function buildCreativeMediaPayload(input: {
  to: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption?: string;
}): MediaMessagePayload {
  const to = toWhatsAppRecipient(input.to);
  const media = {
    link: input.mediaUrl,
    ...(input.caption ? { caption: input.caption } : {}),
  };

  if (input.mediaType === "video") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "video",
      video: media,
    };
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: media,
  };
}

/**
 * Etapa 2b — oferta + cupom em destaque + CTA URL (cardápio / resgate).
 */
export function buildOfferCtaPayload(input: {
  to: string;
  body: string;
  ctaUrl: string;
  ctaLabel?: string;
  header?: string;
  footer?: string;
}): CtaUrlPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppRecipient(input.to),
    type: "interactive",
    interactive: {
      type: "cta_url",
      ...(input.header
        ? { header: { type: "text" as const, text: input.header.slice(0, 60) } }
        : {}),
      body: { text: input.body },
      ...(input.footer ? { footer: { type: "text" as const, text: input.footer } } : {}),
      action: {
        name: "cta_url",
        parameters: {
          display_text: (input.ctaLabel ?? DEFAULT_CTA_LABEL).slice(0, 20),
          url: input.ctaUrl,
        },
      },
    },
  };
}
