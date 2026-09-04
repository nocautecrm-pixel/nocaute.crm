export type RecencySegment = "ativos" | "em_risco" | "inativos" | "perdidos";

export type CampaignStatus =
  | "draft"
  | "queued"
  | "scheduled"
  | "running"
  | "paused"
  | "done"
  | "failed";

export type CampaignJobStatus =
  | "queued"
  | "sending"
  | "sent"
  | "awaiting_confirm"
  | "confirmed"
  | "offer_sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";

export type MediaType = "image" | "video";

export type CouponStatus = "issued" | "redeemed" | "expired";

export type WhatsAppAccountStatus =
  | "pending"
  | "connected"
  | "restricted"
  | "disconnected";

export type Customer = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  lastPurchaseAt: string | null;
  orderCount: number;
  optIn: boolean;
  optInAt: string | null;
  optInSource: string | null;
  optInProof: string | null;
  createdAt: string;
};

export type CustomerRow = Customer & {
  daysWithoutVisit: number;
  segment: RecencySegment | null;
};

export type Campaign = {
  id: string;
  restaurantId: string;
  name: string;
  segment: RecencySegment;
  templateName: string;
  templateLanguage: string;
  status: CampaignStatus;
  createdAt: string;
  startsAt: string | null;
  establishmentName: string;
  promoCode: string;
  offerBody: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  mediaCaption: string | null;
  ctaUrl: string | null;
  ctaLabel: string;
  discountLabel: string;
  audienceId?: string | null;
  audienceName?: string | null;
};

export type Coupon = {
  id: string;
  restaurantId: string;
  campaignId: string;
  customerId: string;
  code: string;
  status: CouponStatus;
  discountLabel: string;
  redeemedAt: string | null;
  redeemedVia: "inbound_whatsapp" | "manual_pos" | null;
};

export type RoiSummary = {
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  couponsIssued: number;
  couponsRedeemed: number;
  conversionRate: number;
};
