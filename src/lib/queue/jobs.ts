export type CampaignSendJob = {
  campaignId: string;
  campaignJobId: string;
  restaurantId: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  templateName: string;
  templateLanguage: string;
  establishmentName: string;
  ctaUrl: string;
  couponCode: string;
};
export type CampaignOfferJob = {
  campaignId: string;
  campaignJobId: string;
  restaurantId: string;
  customerId: string;
  customerPhone: string;
  couponCode: string;
  establishmentName: string;
  discountLabel: string;
  offerBody: string;
  mediaType: "image" | "video" | null;
  mediaUrl: string | null;
  mediaCaption: string | null;
  ctaUrl: string;
  ctaLabel: string;
};

export type WebhookIngestJob = {
  providerEventId: string;
  rawBody: string;
};
