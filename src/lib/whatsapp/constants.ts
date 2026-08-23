export const CONFIRM_BUTTON_TEXT = "Confirmar";
export const CONFIRM_OPTIN_PAYLOAD = "CONFIRM_OPTIN";

/** Template legado (double opt-in). Mantido para campanhas antigas. */
export const OPTIN_TEMPLATE = {
  name: "optin_confirmacao",
  language: "pt_BR",
  category: "MARKETING" as const,
  body: "Olá! Vimos que você é cliente da {{1}}. Estamos atualizando nossos contatos para enviar promoções exclusivas e cupons de desconto em primeira mão. Clique no botão abaixo para confirmar",
  button: CONFIRM_BUTTON_TEXT,
};

/** Template principal para warm base (App Review). */
export const RETURN_TEMPLATE = {
  name: "retorno_15_dias",
  language: "pt_BR",
  category: "MARKETING" as const,
  body: "Olá, {{1}}! Faz um tempinho que não te vemos por aqui. Preparamos uma oferta especial pra você voltar. Toque no botão e confira o cardápio.",
  button: "Ver Cardápio",
};

export const APPROVED_TEMPLATES = [
  RETURN_TEMPLATE,
  {
    name: "aniversario_cliente",
    language: "pt_BR",
    category: "MARKETING" as const,
    body: "Feliz aniversário, {{1}}! A equipe preparou um mimo especial pra você. Toque no botão e resgate seu cupom.",
    button: "Resgatar Cupom",
  },
  {
    name: "cardapio_semana",
    language: "pt_BR",
    category: "MARKETING" as const,
    body: "Oi, {{1}}! O cardápio da semana acabou de sair. Dá uma olhada nas novidades e peça quando quiser.",
    button: "Pedir Agora",
  },
] as const;

export const DEFAULT_CAMPAIGN_TEMPLATE = RETURN_TEMPLATE;

export { DEFAULT_OFFER_BODY } from "@/lib/brand";

export const DEFAULT_MEDIA_CAPTION =
  "Uma oferta leve saiu da cozinha. Confira o cupom na próxima mensagem.";

export const DEFAULT_CTA_LABEL = "Resgatar Cupom";

export const META_CONNECTED_LABEL = "WhatsApp da loja conectado";
export const META_DISCONNECTED_LABEL = "WhatsApp da loja desconectado";

/** Limite Meta: 1 template MARKETING por usuário a cada 24h. */
export const MARKETING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
