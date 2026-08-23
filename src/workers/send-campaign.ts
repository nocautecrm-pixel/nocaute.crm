import { DelayedError, type Job, UnrecoverableError } from "bullmq";
import type { CampaignSendJob } from "@/lib/queue/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OPTIN_TEMPLATE } from "@/lib/whatsapp/constants";
import { classifyWhatsAppError } from "@/lib/whatsapp/errors";
import { MetaGraphError } from "@/lib/whatsapp/graph-client";
import { sendOptInTemplate, sendReturnTemplate } from "@/lib/whatsapp/service";
import {
  consumeCampaignLead,
  refundCampaignLead,
} from "@/server/billing/quota-rpc";
import { getConnectedWhatsAppAccount } from "@/server/whatsapp-account";

export async function processCampaignSend(job: Job<CampaignSendJob>) {
  const data = job.data;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível no worker.");

  const { data: campaign } = await admin
    .from("campaigns")
    .select("status, template_name, template_language, establishment_name")
    .eq("id", data.campaignId)
    .eq("restaurant_id", data.restaurantId)
    .maybeSingle();

  if (!campaign) throw new UnrecoverableError("Campanha não encontrada");

  if (campaign.status === "scheduled") {
    await admin
      .from("campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", data.campaignId)
      .eq("restaurant_id", data.restaurantId);
  }

  if (campaign.status === "paused") {
    await job.moveToDelayed(Date.now() + 30_000, job.token);
    throw new DelayedError();
  }

  if (campaign.status === "failed") {
    throw new UnrecoverableError("Campanha encerrada com falha");
  }

  await admin.from("campaign_jobs").update({ status: "sending" }).eq("id", data.campaignJobId);

  const templateName = data.templateName || campaign.template_name;
  const templateLanguage = data.templateLanguage || campaign.template_language;
  const isLegacyOptIn = templateName === OPTIN_TEMPLATE.name;

  try {
    const credentials = await getConnectedWhatsAppAccount(data.restaurantId);
    const result = isLegacyOptIn
      ? await sendOptInTemplate(credentials, {
          to: data.customerPhone,
          establishmentName: data.establishmentName || campaign.establishment_name,
          templateName,
          language: templateLanguage,
        })
      : await sendReturnTemplate(credentials, {
          to: data.customerPhone,
          customerName: data.customerName,
          ctaUrl: data.ctaUrl,
          couponCode: data.couponCode,
          templateName,
          language: templateLanguage,
        });

    await admin
      .from("campaign_jobs")
      .update({
        status: isLegacyOptIn ? "awaiting_confirm" : "sent",
        provider_message_id: result.wamid,
        optin_wamid: result.wamid,
        sent_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", data.campaignJobId);

    await consumeCampaignLead({
      restaurantId: data.restaurantId,
      campaignId: data.campaignId,
      campaignJobId: data.campaignJobId,
    });
  } catch (error) {
    if (error instanceof UnrecoverableError) throw error;
    await handleSendError(admin, data, error);
  }
}

async function handleSendError(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  data: CampaignSendJob,
  error: unknown,
) {
  const code = error instanceof MetaGraphError ? error.code : undefined;
  const action = classifyWhatsAppError(code);

  await admin
    .from("campaign_jobs")
    .update({
      status: action === "skip" ? "skipped" : "failed",
      error_code: code ? String(code) : null,
      error_message: error instanceof Error ? error.message : "Erro no disparo",
    })
    .eq("id", data.campaignJobId);

  await refundCampaignLead({
    restaurantId: data.restaurantId,
    campaignId: data.campaignId,
    campaignJobId: data.campaignJobId,
  }).catch(() => undefined);

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
