import { DelayedError, type Job, UnrecoverableError } from "bullmq";
import type { CampaignSendJob } from "@/lib/queue/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OPTIN_TEMPLATE } from "@/lib/whatsapp/constants";
import { sendOptInTemplate, sendReturnTemplate } from "@/lib/whatsapp/service";
import { consumeCampaignLead, refundCampaignLead } from "@/server/billing/quota-rpc";
import { guardedDelivery, DeliveryPausedError, DeliverySuppressedError } from "@/server/compliance/delivery-guard";
import { getConnectedWhatsAppAccount } from "@/server/whatsapp-account";

export async function processCampaignSend(job: Job<CampaignSendJob>) {
  const data = job.data;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível no worker.");
  const { data: campaign, error } = await admin.from("campaigns")
    .select("status, template_name, template_language, establishment_name")
    .eq("id", data.campaignId).eq("restaurant_id", data.restaurantId).maybeSingle();
  if (error) throw error;
  if (!campaign) throw new UnrecoverableError("Campanha não encontrada");
  const isOptIn = campaign.template_name === OPTIN_TEMPLATE.name;
  const credentials = await getConnectedWhatsAppAccount(data.restaurantId);
  let wamid: string;
  try {
    wamid = await guardedDelivery(data, "initial", (customer) => isOptIn
      ? sendOptInTemplate(credentials, {
          to: customer.phone, establishmentName: campaign.establishment_name,
          templateName: campaign.template_name, language: campaign.template_language,
        })
      : sendReturnTemplate(credentials, {
          to: customer.phone, customerName: customer.name, ctaUrl: data.ctaUrl,
          couponCode: data.couponCode, templateName: campaign.template_name,
          language: campaign.template_language,
        }));
  } catch (error) {
    if (error instanceof DeliverySuppressedError) {
      // Only known-unsent work is refundable. Missing/deleted jobs have no live
      // reservation to settle here and are handled by erasure reconciliation.
      const existing = await admin.from("campaign_jobs").select("id").eq("id", data.campaignJobId)
        .eq("restaurant_id", data.restaurantId).eq("campaign_id", data.campaignId)
        .eq("customer_id", data.customerId).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        await refundCampaignLead(data);
        const skipped = await admin.from("campaign_jobs").update({ status: "skipped" })
          .eq("id", data.campaignJobId).eq("restaurant_id", data.restaurantId).eq("status", "queued");
        if (skipped.error) throw skipped.error;
      }
      throw error;
    }
    if (error instanceof DeliveryPausedError) {
      await job.moveToDelayed(Date.now() + 30_000, job.token);
      throw new DelayedError();
    }
    throw error;
  }
  // Persistence/settlement failures retry locally: the accepted attempt supplies
  // its receipt without a new provider request.
  const saved = await admin.from("campaign_jobs").update({
    status: isOptIn ? "awaiting_confirm" : "sent", provider_message_id: wamid,
    optin_wamid: wamid, sent_at: new Date().toISOString(), error_code: null, error_message: null,
  }).eq("id", data.campaignJobId).eq("restaurant_id", data.restaurantId)
    .in("status", ["queued", "sending"]);
  if (saved.error) throw saved.error;
  await consumeCampaignLead(data);
  if (campaign.status === "scheduled" || campaign.status === "queued") {
    const started = await admin.from("campaigns").update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", data.campaignId).eq("restaurant_id", data.restaurantId).eq("status", campaign.status);
    if (started.error) throw started.error;
  }
}
