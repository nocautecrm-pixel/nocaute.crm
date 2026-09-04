import { DEFAULT_OFFER_BODY } from "@/lib/brand";
import {
  OPTIN_TEMPLATE,
  RETURN_TEMPLATE,
} from "@/lib/whatsapp/constants";

export const DEFAULT_OPTIN_TEMPLATE = {
  name: OPTIN_TEMPLATE.name,
  language: OPTIN_TEMPLATE.language,
  bodyExample: OPTIN_TEMPLATE.body.replace("{{1}}", "[Nome da Loja]"),
  buttons: OPTIN_TEMPLATE.buttons,
};

export const DEFAULT_RETURN_TEMPLATE = {
  name: RETURN_TEMPLATE.name,
  language: RETURN_TEMPLATE.language,
  bodyExample: RETURN_TEMPLATE.body.replace("{{1}}", "[Nome do Cliente]"),
  button: RETURN_TEMPLATE.button,
  offerExample: DEFAULT_OFFER_BODY,
};
