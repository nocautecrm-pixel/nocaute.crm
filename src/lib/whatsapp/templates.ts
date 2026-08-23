import {
  DEFAULT_CTA_LABEL,
  DEFAULT_MEDIA_CAPTION,
  DEFAULT_OFFER_BODY,
  RETURN_TEMPLATE,
} from "@/lib/whatsapp/constants";

export const DEFAULT_RETURN_TEMPLATE = {
  name: RETURN_TEMPLATE.name,
  language: RETURN_TEMPLATE.language,
  bodyExample: RETURN_TEMPLATE.body.replace("{{1}}", "[Nome do Cliente]"),
  button: RETURN_TEMPLATE.button,
  offerExample: DEFAULT_OFFER_BODY,
  mediaCaption: DEFAULT_MEDIA_CAPTION,
  ctaLabel: DEFAULT_CTA_LABEL,
};
