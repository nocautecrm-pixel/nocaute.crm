import {
  DEFAULT_CTA_LABEL,
  DEFAULT_MEDIA_CAPTION,
  DEFAULT_OFFER_BODY,
} from "@/lib/whatsapp/constants";
import { postWhatsAppMessage } from "@/lib/whatsapp/graph-client";
import {
  buildCreativeMediaPayload,
  buildOfferCtaPayload,
  buildOptInTemplatePayload,
  buildReturnTemplatePayload,
  buildTextPayload,
  interpolateOfferText,
  withCouponQuery,
} from "@/lib/whatsapp/payloads";

export type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

export type ConversionOfferInput = {
  to: string;
  establishmentName: string;
  couponCode: string;
  discountLabel: string;
  offerBody?: string;
  mediaType?: "image" | "video";
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  ctaUrl: string;
  ctaLabel?: string;
};

async function send(credentials: WhatsAppCredentials, payload: Record<string, unknown>) {
  return postWhatsAppMessage({
    phoneNumberId: credentials.phoneNumberId,
    accessToken: credentials.accessToken,
    payload,
  });
}

export async function sendTextMessage(
  credentials: WhatsAppCredentials,
  input: { to: string; body: string },
) {
  const payload = buildTextPayload(input.to, input.body);
  return {
    wamid: await send(credentials, payload),
    payload,
  };
}

export async function sendOptInTemplate(
  credentials: WhatsAppCredentials,
  input: {
    to: string;
    establishmentName: string;
    templateName?: string;
    language?: string;
  },
) {
  const payload = buildOptInTemplatePayload(input);
  return {
    wamid: await send(credentials, payload),
    payload,
  };
}

export async function sendReturnTemplate(
  credentials: WhatsAppCredentials,
  input: {
    to: string;
    customerName: string;
    ctaUrl: string;
    couponCode?: string;
    templateName?: string;
    language?: string;
  },
) {
  const payload = buildReturnTemplatePayload(input);
  return {
    wamid: await send(credentials, payload),
    payload,
  };
}

export async function sendCreativeMedia(
  credentials: WhatsAppCredentials,
  input: {
    to: string;
    mediaType: "image" | "video";
    mediaUrl: string;
    caption?: string;
  },
) {
  const payload = buildCreativeMediaPayload(input);
  return {
    wamid: await send(credentials, payload),
    payload,
  };
}

export async function sendOfferCta(
  credentials: WhatsAppCredentials,
  input: {
    to: string;
    body: string;
    ctaUrl: string;
    ctaLabel?: string;
    header?: string;
    footer?: string;
  },
) {
  const payload = buildOfferCtaPayload(input);
  return {
    wamid: await send(credentials, payload),
    payload,
  };
}

export async function sendConversionSequence(
  credentials: WhatsAppCredentials,
  input: ConversionOfferInput,
) {
  const coupon = input.couponCode;
  const body = interpolateOfferText(input.offerBody ?? DEFAULT_OFFER_BODY, {
    loja: input.establishmentName,
    cupom: coupon,
    desconto: input.discountLabel,
  });

  const mediaWamid =
    input.mediaUrl && input.mediaType
      ? (
          await sendCreativeMedia(credentials, {
            to: input.to,
            mediaType: input.mediaType,
            mediaUrl: input.mediaUrl,
            caption: input.mediaCaption ?? DEFAULT_MEDIA_CAPTION,
          })
        ).wamid
      : null;

  const cta = await sendOfferCta(credentials, {
    to: input.to,
    body,
    ctaUrl: withCouponQuery(input.ctaUrl, coupon),
    ctaLabel: input.ctaLabel ?? DEFAULT_CTA_LABEL,
    header: "Seu cupom está pronto",
    footer: coupon,
  });

  return {
    mediaWamid,
    offerWamid: cta.wamid,
  };
}
