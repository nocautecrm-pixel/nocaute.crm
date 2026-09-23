import { DelayedError, type Job } from "bullmq";
import type { CampaignOfferJob } from "@/lib/queue/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CTA_LABEL, DEFAULT_MEDIA_CAPTION, DEFAULT_OFFER_BODY } from "@/lib/whatsapp/constants";
import { interpolateOfferText, withCouponQuery } from "@/lib/whatsapp/payloads";
import { sendCreativeMedia, sendOfferCta } from "@/lib/whatsapp/service";
import { guardedDelivery, DeliveryPausedError } from "@/server/compliance/delivery-guard";
import { getConnectedWhatsAppAccount } from "@/server/whatsapp-account";

export async function processCampaignOffer(job: Job<CampaignOfferJob>) {
  const data = job.data;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível no worker.");
  const credentials = await getConnectedWhatsAppAccount(data.restaurantId);
  try {
    if (data.mediaUrl && data.mediaType) {
      await guardedDelivery(data, "offer_media", (customer) => sendCreativeMedia(credentials, {
        to: customer.phone, mediaType: data.mediaType!, mediaUrl: data.mediaUrl!,
        caption: data.mediaCaption ?? DEFAULT_MEDIA_CAPTION,
      }));
    }
    const wamid = await guardedDelivery(data, "offer_cta", (customer) => sendOfferCta(credentials, {
      to: customer.phone,
      body: interpolateOfferText(data.offerBody || DEFAULT_OFFER_BODY, {
        loja: data.establishmentName, cupom: data.couponCode, desconto: data.discountLabel,
      }),
      ctaUrl: withCouponQuery(data.ctaUrl, data.couponCode),
      ctaLabel: data.ctaLabel || DEFAULT_CTA_LABEL, header: "Seu cupom está pronto", footer: data.couponCode,
    }));
    const saved = await admin.from("campaign_jobs").update({
      status: "offer_sent", provider_message_id: wamid, offer_wamid: wamid,
      error_code: null, error_message: null,
    }).eq("id", data.campaignJobId).eq("restaurant_id", data.restaurantId).eq("status", "confirmed");
    if (saved.error) throw saved.error;
  } catch (error) {
    if (error instanceof DeliveryPausedError) {
      await job.moveToDelayed(Date.now() + 30_000, job.token);
      throw new DelayedError();
    }
    throw error;
  }
}
