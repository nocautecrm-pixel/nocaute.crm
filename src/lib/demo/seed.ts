import { BRAND, DEFAULT_OFFER_BODY } from "@/lib/brand";
import { DEMO_RESTAURANT_ID } from "@/lib/config";
import type { Campaign, Customer, RoiSummary } from "@/types/database";

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const demoOptIn = (source: string, proof: string, at: string) => ({  optIn: true,
  optInAt: at,
  optInSource: source,
  optInProof: proof,
});

export const demoCustomers: Customer[] = [
  {
    id: "c-maria",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Maria Silva",
    phone: "+5511991112222",
    lastPurchaseAt: daysAgo(3),
    ...demoOptIn("balcao", "PDV-1042", daysAgo(90)),
    createdAt: daysAgo(90),
  },
  {
    id: "c-joao",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "João Santos",
    phone: "+5511993334444",
    lastPurchaseAt: daysAgo(22),
    ...demoOptIn("delivery", "IFOOD-88291", daysAgo(120)),
    createdAt: daysAgo(120),
  },
  {
    id: "c-ana",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Ana Costa",
    phone: "+5511985556666",
    lastPurchaseAt: daysAgo(45),
    ...demoOptIn("reserva", "RES-3301", daysAgo(200)),
    createdAt: daysAgo(200),
  },
  {
    id: "c-pedro",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Pedro Lima",
    phone: "+5511977778888",
    lastPurchaseAt: daysAgo(80),
    ...demoOptIn("wifi", "WIFI-2201", daysAgo(250)),
    createdAt: daysAgo(250),
  },
  {
    id: "c-lucia",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Lúcia Ferreira",
    phone: "+5511961234567",
    lastPurchaseAt: daysAgo(12),
    optIn: false,
    optInAt: null,
    optInSource: null,
    optInProof: null,
    createdAt: daysAgo(40),
  },
  {
    id: "c-carlos",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Carlos Mendes",
    phone: "+5511951110000",
    lastPurchaseAt: daysAgo(150),
    ...demoOptIn("balcao", "PDV-9910", daysAgo(400)),
    createdAt: daysAgo(400),
  },
];

export const demoCampaigns: Campaign[] = [
  {
    id: "camp-inativos",
    restaurantId: DEMO_RESTAURANT_ID,
    name: BRAND.campaignName,
    segment: "inativos",
    templateName: "retorno_15_dias",
    templateLanguage: "pt_BR",
    status: "running",
    createdAt: daysAgo(1),
    startsAt: null,
    establishmentName: BRAND.storeName,
    promoCode: BRAND.promoCode,
    offerBody: DEFAULT_OFFER_BODY,
    mediaType: "image",
    mediaUrl: null,
    mediaCaption: "Uma oferta leve saiu da cozinha.",
    ctaUrl: BRAND.ctaUrl,
    ctaLabel: "Resgatar Cupom",
    discountLabel: "15% OFF",
  },
  {
    id: "camp-agendada",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Almoço de quarta",
    segment: "em_risco",
    templateName: "retorno_15_dias",
    templateLanguage: "pt_BR",
    status: "scheduled",
    createdAt: daysAgo(0),
    startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    establishmentName: BRAND.storeName,
    promoCode: BRAND.promoCode,
    offerBody: DEFAULT_OFFER_BODY,
    mediaType: null,
    mediaUrl: null,
    mediaCaption: null,
    ctaUrl: BRAND.ctaUrl,
    ctaLabel: "Resgatar Cupom",
    discountLabel: "15% OFF",
  },
  {
    id: "camp-pausada",
    restaurantId: DEMO_RESTAURANT_ID,
    name: "Reativação de junho",
    segment: "perdidos",
    templateName: "retorno_15_dias",
    templateLanguage: "pt_BR",
    status: "paused",
    createdAt: daysAgo(12),
    startsAt: null,
    establishmentName: BRAND.storeName,
    promoCode: BRAND.promoCode,
    offerBody: DEFAULT_OFFER_BODY,
    mediaType: null,
    mediaUrl: null,
    mediaCaption: null,
    ctaUrl: BRAND.ctaUrl,
    ctaLabel: "Resgatar Cupom",
    discountLabel: "15% OFF",
  },
];

export const demoRoi: RoiSummary = {
  queued: 1,
  sent: 12,
  delivered: 11,
  failed: 1,
  couponsIssued: 12,
  couponsRedeemed: 3,
  conversionRate: 25,
};
