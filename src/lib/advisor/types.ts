import type { RecencySegment } from "@/types/database";

export type CampaignDraft = {
  name: string;
  audienceSlug: string;
  segment?: RecencySegment;
  templateName: string;
  establishmentName: string;
  promoCode: string;
  discountLabel: string;
  offerBody: string;
  ctaUrl: string;
};

export type AdviceAction =
  | { type: "prefill_campaign"; draft: CampaignDraft }
  | { type: "navigate"; href: string }
  | { type: "none" };

export type AdviceKind = "campaign" | "ops" | "hold";

export type Advice = {
  id: string;
  kind: AdviceKind;
  title: string;
  why: string;
  priority: 1 | 2 | 3;
  ctaLabel: string;
  action: AdviceAction;
};

export type AdvisorSnapshot = {
  storeName: string;
  menuUrl: string;
  whatsappConnected: boolean;
  qualityRating: string | null;
  quotaRemaining: number;
  quotaIncluded: number;
  optedInTotal: number;
  totalCustomers: number;
  byAudience: Record<string, number>;
  audienceLabels: Record<string, string>;
  inFlightCount: number;
  lastCampaignName: string | null;
  conversionRate: number;
  recentAudienceAt: Partial<Record<string, string>>;
  now: Date;
};
