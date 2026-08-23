import type { QuotaSnapshot } from "@/lib/billing/plans";
import type { BrandDna } from "@/lib/chatbot/dna";

export type WhatsAppConnection = {
  connected: boolean;
  channel: "WhatsApp Business";
  provider: "Meta Cloud API";
  label: string;
  displayPhone: string | null;
  verifiedName: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  graphVersion: string;
  qualityRating: string | null;
  lastInboundAt: string | null;
  windowOpen: boolean;
  windowHoursLeft: number | null;
};

export type MetaHealthItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type StorePanel = {
  productName: string;
  storeName: string;
  city: string;
  logoUrl: string | null;
  menuUrl: string;
  address: string;
  hoursText: string;
  whatsapp: WhatsAppConnection;
  chatbot: BrandDna;
  quota: QuotaSnapshot;
  meta: {
    officialApi: true;
    ready: boolean;
    items: MetaHealthItem[];
  };
  kpis: {
    revenueMonth: number;
    revenueGrowthPct: number;
    reactivated30d: number;
    couponConversionPct: number;
  };
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    sends: number;
    conversionPct: number;
    revenue: number;
  }>;
};
