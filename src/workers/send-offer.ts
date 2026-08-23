import { DelayedError, type Job, UnrecoverableError } from "bullmq";
import type { CampaignOfferJob } from "@/lib/queue/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyWhatsAppError } from "@/lib/whatsapp/errors";
import { MetaGraphError } from "@/lib/whatsapp/graph-client";
import { sendConversionSequence } from "@/lib/whatsapp/service";
import { getConnectedWhatsAppAccount } from "@/server/whatsapp-account";

export async function processCampaignOffer(job: Job<CampaignOfferJob>) {
  const data = job.data;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível no worker.");

  const { data: campaign } = await admin
    .from("campaigns")
    .select("status")
    .eq("id", data.campaignId)
    .eq("restaurant_id", data.restaurantId)
    .maybeSingle();

  if (!campaign) throw new UnrecoverableError("Campanha não encontrada");

  if (campaign.status === "paused") {
    await job.moveToDelayed(Date.now() + 30_000, job.token);
    throw new DelayedError();
  }

  const { data: currentJob } = await admin
    .from("campaign_jobs")
    .select("status")
    .eq("id", data.campaignJobId)
    .single();

  if (currentJob?.status === "offer_sent") return;

  try {
    const credentials = await getConnectedWhatsAppAccount(data.restaurantId);
    const result = await sendConversionSequence(credentials, {
      to: data.customerPhone,
      establishmentName: data.establishmentName,
      couponCode: data.couponCode,
      discountLabel: data.discountLabel,
      offerBody: data.offerBody,
      mediaType: data.mediaType ?? undefined,
      mediaUrl: data.mediaUrl,
      mediaCaption: data.mediaCaption,
      ctaUrl: data.ctaUrl,
      ctaLabel: data.ctaLabel,
    });

    await admin
      .from("campaign_jobs")
      .update({
        status: "offer_sent",
        provider_message_id: result.offerWamid,
        offer_wamid: result.offerWamid,
        error_code: null,
        error_message: null,
      })
      .eq("id", data.campaignJobId);
  } catch (error) {
    const code = error instanceof MetaGraphError ? error.code : undefined;
    const action = classifyWhatsAppError(code);

    await admin
      .from("campaign_jobs")
      .update({
        status: action === "skip" ? "skipped" : "failed",
        error_code: code ? String(code) : null,
        error_message: error instanceof Error ? error.message : "Erro na sequência de oferta",
      })
      .eq("id", data.campaignJobId);

    if (action === "pause") {
      await admin
        .from("campaigns")
        .update({ status: "paused", paused_at: new Date().toISOString() })
        .eq("id", data.campaignId)
        .eq("restaurant_id", data.restaurantId);
      throw new UnrecoverableError("Quality/rate limit da WABA — campanha pausada");
    }

    if (action === "skip") return;
    if (error instanceof Error && error.message.includes("não está conectado")) {
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }
}
