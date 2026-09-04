import { BRAND } from "@/lib/brand";
import { currentCalendarPeriod, DEFAULT_PLAN, remainingOf } from "@/lib/billing/plans";
import { getGraphVersion } from "@/lib/config";
import {
  META_CONNECTED_LABEL,
  META_DISCONNECTED_LABEL,
  OPTIN_TEMPLATE,
} from "@/lib/whatsapp/constants";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { MetaHealthItem, StorePanel, WhatsAppConnection } from "@/types/store";

function emptyChannel(): Pick<
  WhatsAppConnection,
  "qualityRating" | "lastInboundAt" | "windowOpen" | "windowHoursLeft"
> {
  return {
    qualityRating: null,
    lastInboundAt: null,
    windowOpen: false,
    windowHoursLeft: null,
  };
}

const DEMO_DISPLAY_PHONE = "+55 11 98888-1010";

export function buildMetaHealth(input: {
  connected: boolean;
  storeName: string;
  displayPhone?: string | null;
  verifiedName?: string | null;
  quotaUsed?: number;
  quotaIncluded?: number;
  signupConfigured?: boolean;
  webhookReceived?: boolean;
  webhookUrl?: string;
}): StorePanel["meta"] {
  const phone = formatWhatsAppPhone(input.displayPhone) ?? input.displayPhone;
  const accountName = input.verifiedName?.trim() || input.storeName;
  const used = input.quotaUsed ?? 0;
  const included = input.quotaIncluded ?? DEFAULT_PLAN.includedLeads;
  const signupConfigured = input.signupConfigured ?? false;
  const webhookUrl = input.webhookUrl ?? "/api/webhooks/whatsapp";

  const items: MetaHealthItem[] = [
    {
      id: "official",
      label: "WhatsApp oficial da Meta",
      ok: true,
      detail: "A loja usa o canal homologado. Não é QR, extensão nem número paralelo.",
    },
    {
      id: "signup",
      label: "Embedded Signup / app Meta",
      ok: signupConfigured,
      detail: signupConfigured
        ? "App ID, secret, config id e token de webhook estão no servidor."
        : "Faltam META_APP_ID, META_APP_SECRET, WEBHOOK_VERIFY_TOKEN ou o config id público do Embedded Signup.",
    },
    {
      id: "waba",
      label: "Conta WhatsApp Business",
      ok: input.connected,
      detail: input.connected
        ? `A Meta ligou a conta da ${accountName} nesta ferramenta.`
        : "Falta o login da Meta para puxar a conta da loja.",
    },
    {
      id: "phone",
      label: phone ? `WhatsApp Business: ${phone}` : "Número da loja",
      ok: input.connected,
      detail: input.connected
        ? "É este número que dispara e que o cliente já tem salvo. Tem que ser o da casa, não um número de teste."
        : "O número aparece aqui depois do login da Meta.",
    },
    {
      id: "coexistence",
      label: "Celular da loja",
      ok: input.connected,
      detail: input.connected
        ? "Celular e WhatsApp Web só continuam se o número estiver em coexistência na Meta. Depois de conectar, abra o app da loja e confirme que as conversas seguem lá."
        : "A Cloud API não substitui o atendimento. Teste no aparelho da casa após o login.",
    },
    {
      id: "templates",
      label: "Templates APPROVED",
      ok: input.connected,
      detail: `Campanha só dispara se "${OPTIN_TEMPLATE.name}" (Continuar / Não receber oferta) estiver APPROVED nesta WABA. JSON em public/templates/.`,
    },
    {
      id: "quota",
      label: "Franquia da Nocaute",
      ok: true,
      detail: `${used} / ${included} leads neste mês. Isso é o plano da ferramenta — conversa na Meta é cobrada à parte.`,
    },
    {
      id: "webhook",
      label: "Respostas dos clientes",
      ok: Boolean(input.webhookReceived),
      detail: input.webhookReceived
        ? "A Meta já entregou evento neste webhook. Continuar / Não receber oferta e cupom inbound estão chegando."
        : input.connected
          ? `Ainda não chegou evento. No app da Meta cadastre ${webhookUrl} (WhatsApp → Configuration) e o mesmo WEBHOOK_VERIFY_TOKEN.`
          : "Ativa depois do login da Meta e do cadastro do webhook HTTPS.",
    },
  ];

  return {
    officialApi: true,
    ready: input.connected && signupConfigured,
    items,
  };
}

export const DEMO_STORE: StorePanel = {
  productName: BRAND.productName,
  storeName: BRAND.storeName,
  city: "",
  logoUrl: null,
  menuUrl: "",
  address: "",
  hoursText: "",
  whatsapp: {
    connected: false,
    channel: "WhatsApp Business",
    provider: "Meta Cloud API",
    label: META_DISCONNECTED_LABEL,
    displayPhone: null,
    verifiedName: null,
    wabaId: null,
    phoneNumberId: null,
    graphVersion: getGraphVersion(),
    ...emptyChannel(),
  },
  quota: {
    planSlug: DEFAULT_PLAN.slug,
    planName: DEFAULT_PLAN.name,
    priceCents: DEFAULT_PLAN.priceCents,
    included: DEFAULT_PLAN.includedLeads,
    extra: 0,
    used: 0,
    reserved: 0,
    remaining: remainingOf({
      included: DEFAULT_PLAN.includedLeads,
      extra: 0,
      used: 0,
      reserved: 0,
    }),
    periodStart: currentCalendarPeriod().start,
    periodEnd: currentCalendarPeriod().end,
  },
  meta: buildMetaHealth({
    connected: false,
    storeName: BRAND.storeName,
    signupConfigured: true,
  }),
  kpis: {
    revenueMonth: 5430,
    revenueGrowthPct: 12,
    reactivated30d: 168,
    couponConversionPct: 29.5,
  },
  recentCampaigns: [
    {
      id: "camp-inativos",
      name: BRAND.campaignName,
      status: "running",
      statusLabel: "Ativa",
      sends: 1,
      conversionPct: 0,
      revenue: 5300,
    },
  ],
};

export const DEMO_WHATSAPP_COOKIE = "wa_demo_connected";

export function withDemoWhatsAppConnection(
  store: StorePanel,
  connected: boolean,
): StorePanel {
  if (!connected) {
    return {
      ...store,
      whatsapp: {
        ...store.whatsapp,
        connected: false,
        label: META_DISCONNECTED_LABEL,
        displayPhone: null,
        verifiedName: null,
        wabaId: null,
        phoneNumberId: null,
        ...emptyChannel(),
      },
      meta: buildMetaHealth({
        connected: false,
        storeName: store.storeName,
        quotaUsed: store.quota.used,
        quotaIncluded: store.quota.included,
        signupConfigured: true,
      }),
    };
  }

  return {
    ...store,
    whatsapp: {
      ...store.whatsapp,
      connected: true,
      label: META_CONNECTED_LABEL,
      displayPhone: DEMO_DISPLAY_PHONE,
      verifiedName: store.storeName,
      wabaId: "WABA-DEMO",
      phoneNumberId: "PHONE-DEMO",
      qualityRating: "GREEN",
      lastInboundAt: new Date().toISOString(),
      windowOpen: true,
      windowHoursLeft: 24,
    },
    meta: buildMetaHealth({
      connected: true,
      storeName: store.storeName,
      displayPhone: DEMO_DISPLAY_PHONE,
      verifiedName: store.storeName,
      quotaUsed: store.quota.used,
      quotaIncluded: store.quota.included,
      signupConfigured: true,
      webhookReceived: true,
    }),
  };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function campaignStatusLabel(status: string) {
  if (status === "running" || status === "queued") return "Ativa";
  if (status === "scheduled") return "Agendada";
  if (status === "paused") return "Pausada";
  if (status === "done") return "Encerrada";
  if (status === "failed") return "Falhou";
  if (status === "draft") return "Rascunho";
  return status;
}
