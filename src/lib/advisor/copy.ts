import { OPTIN_TEMPLATE } from "@/lib/whatsapp/constants";
import type { CampaignDraft } from "@/lib/advisor/types";

const OFFER_BY_AUDIENCE: Record<string, string> = {
  ativos: `O cardápio da semana na {{loja}} acabou de sair. Cliente da casa garante {{desconto}} no pedido.

Seu cupom: *{{cupom}}*

Mostre no caixa ou toque no botão para resgatar.`,
  em_risco: `A {{loja}} sentiu sua falta. Uma oferta rápida pra você voltar esta semana: {{desconto}}.

Seu cupom exclusivo: *{{cupom}}*

Mostre este código no caixa ou toque no botão para resgatar.`,
  inativos: `Faz um tempo que você não aparece na {{loja}}. Por isso você foi escolhido para ganhar {{desconto}}.

Seu cupom exclusivo: *{{cupom}}*

Mostre este código no caixa ou toque no botão para resgatar.`,
  perdidos: `Sentimos sua falta na {{loja}}. Preparamos {{desconto}} para te receber de novo.

Seu cupom exclusivo: *{{cupom}}*

Mostre este código no caixa ou toque no botão para resgatar.`,
};

const DISCOUNT_BY_AUDIENCE: Record<string, { label: string; digits: string }> = {
  ativos: { label: "10% OFF", digits: "10" },
  em_risco: { label: "12% OFF", digits: "12" },
  inativos: { label: "15% OFF", digits: "15" },
  perdidos: { label: "20% OFF", digits: "20" },
};

const NAME_BY_AUDIENCE: Record<string, string> = {
  ativos: "Cardápio da semana",
  em_risco: "Retorno rápido",
  inativos: "Reativação",
  perdidos: "Volta pra casa",
};

export function promoCodeFor(storeName: string, digits: string) {
  const letters = storeName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const prefix = (letters.slice(0, 6) || "LOJA").slice(0, 16 - digits.length);
  return `${prefix}${digits}`;
}

export function buildCampaignDraft(input: {
  storeName: string;
  menuUrl: string;
  audienceSlug: string;
  audienceName?: string;
}): CampaignDraft {
  const discount = DISCOUNT_BY_AUDIENCE[input.audienceSlug] ?? DISCOUNT_BY_AUDIENCE.inativos;
  const offer = OFFER_BY_AUDIENCE[input.audienceSlug] ?? OFFER_BY_AUDIENCE.inativos;
  const namePart = NAME_BY_AUDIENCE[input.audienceSlug] ?? input.audienceName ?? "Retorno";
  return {
    name: `${input.storeName} — ${namePart}`,
    audienceSlug: input.audienceSlug,
    templateName: OPTIN_TEMPLATE.name,
    establishmentName: input.storeName,
    promoCode: promoCodeFor(input.storeName, discount.digits),
    discountLabel: discount.label,
    offerBody: offer,
    ctaUrl: input.menuUrl,
  };
}
