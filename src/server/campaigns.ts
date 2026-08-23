import { cookies } from "next/headers";
import { BRAND } from "@/lib/brand";
import {
  BackendUnavailableError,
  DEMO_RESTAURANT_ID,
  isDemoMode,
  isRedisConfigured,
  requireLiveBackend,
} from "@/lib/config";
import { generateCouponCode } from "@/lib/coupons/generate";
import { demoCampaigns } from "@/lib/demo/seed";
import { getCampaignSendQueue } from "@/lib/queue/queues";
import type { CampaignSendJob } from "@/lib/queue/jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCampaignSchema } from "@/lib/validations";
import { DEFAULT_CAMPAIGN_TEMPLATE } from "@/lib/whatsapp/constants";
import { customerFirstName } from "@/lib/customers/opt-in";
import { findCustomersInMarketingCooldown } from "@/server/compliance/marketing-guard";
import { reserveCampaignQuota } from "@/server/billing/quota-gateway";
import { releaseCampaignQuota } from "@/server/billing/quota-rpc";
import { listOptedInBySegment } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";
import { assertWhatsAppReadyForCampaign } from "@/server/whatsapp-health";
import type { Campaign } from "@/types/database";

const CAMPAIGN_COLUMNS =
  "id, restaurant_id, name, segment, template_name, template_language, status, created_at, starts_at, establishment_name, promo_code, offer_body, media_type, media_url, media_caption, cta_url, cta_label, discount_label";
const DEMO_CAMPAIGNS_COOKIE = "nocaute_campaigns";

function mapCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    segment: row.segment as Campaign["segment"],
    templateName: row.template_name as string,
    templateLanguage: row.template_language as string,
    status: row.status as Campaign["status"],
    createdAt: row.created_at as string,
    startsAt: (row.starts_at as string) ?? null,
    establishmentName: (row.establishment_name as string) ?? BRAND.storeName,
    promoCode: (row.promo_code as string) ?? BRAND.promoCode,
    offerBody: (row.offer_body as string) ?? "",
    mediaType: (row.media_type as Campaign["mediaType"]) ?? null,
    mediaUrl: (row.media_url as string) ?? null,
    mediaCaption: (row.media_caption as string) ?? null,
    ctaUrl: (row.cta_url as string) ?? null,
    ctaLabel: (row.cta_label as string) ?? "Resgatar Cupom",
    discountLabel: (row.discount_label as string) ?? "15% OFF",
  };
}

function normalizeHttpUrl(url?: string) {
  const value = url?.trim();
  if (!value) return BRAND.ctaUrl;
  if (!/^https?:\/\//i.test(value)) return `https://${value}`;
  return value;
}

function resolveSchedule(raw?: string) {
  if (!raw?.trim()) return { startsAt: null as string | null, delayMs: 0, scheduled: false };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("Data de agendamento inválida.");
  const delayMs = date.getTime() - Date.now();
  if (delayMs > 90 * 86_400_000) throw new Error("Agende no máximo 90 dias.");
  if (delayMs > 60_000) {
    return { startsAt: date.toISOString(), delayMs, scheduled: true };
  }
  return { startsAt: null as string | null, delayMs: 0, scheduled: false };
}

async function readDemoCreated(): Promise<Campaign[]> {
  const jar = await cookies();
  const raw = jar.get(DEMO_CAMPAIGNS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Campaign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDemoCreated(campaigns: Campaign[]) {
  const jar = await cookies();
  jar.set(DEMO_CAMPAIGNS_COOKIE, JSON.stringify(campaigns.slice(0, 8)), {
    path: "/",
    sameSite: "lax",
  });
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (isDemoMode()) {
    const extras = await readDemoCreated();
    return [...extras, ...demoCampaigns];
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const restaurantId = await getCurrentRestaurantId();
  const query = admin
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapCampaign(row as Record<string, unknown>));
}

export async function getCampaign(id: string) {
  const campaigns = await listCampaigns();
  return campaigns.find((campaign) => campaign.id === id) ?? null;
}

export async function createCampaign(restaurantId: string, input: unknown) {
  const payload = createCampaignSchema.parse(input);
  const segmentMatches = (await listOptedInBySegment(payload.segment, restaurantId)).filter(
    (customer) => customer.segment === payload.segment,
  );
  const cooldown = await findCustomersInMarketingCooldown(
    restaurantId,
    segmentMatches.map((customer) => customer.id),
  );
  const recipients = segmentMatches.filter((customer) => !cooldown.has(customer.id));
  const ctaUrl = normalizeHttpUrl(payload.ctaUrl);
  const schedule = resolveSchedule(payload.startsAt);
  const status = schedule.scheduled ? ("scheduled" as const) : ("queued" as const);

  if (segmentMatches.length === 0) {
    throw new Error(
      "Nenhum cliente com opt-in comprovado neste segmento. Importe a planilha com origem e comprovante.",
    );
  }

  if (recipients.length === 0) {
    throw new Error(
      "Todos os clientes elegíveis já receberam marketing nas últimas 24h (limite Meta).",
    );
  }

  if (!isDemoMode()) {
    await assertWhatsAppReadyForCampaign(restaurantId, payload.templateName);
  }

  await reserveCampaignQuota({
    restaurantId,
    leads: recipients.length,
  });

  const whenLabel = schedule.startsAt
    ? new Date(schedule.startsAt).toLocaleString("pt-BR")
    : null;
  const successMessage = schedule.scheduled
    ? `Campanha agendada para ${whenLabel} · ${recipients.length} lead(s) com opt-in comprovado.`
    : `Fila pronta para ${recipients.length} lead(s) com opt-in comprovado.`;

  if (isDemoMode()) {
    const campaign: Campaign = {
      id: `demo-${Date.now()}`,
      restaurantId,
      name: payload.name,
      segment: payload.segment,
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      status: schedule.scheduled ? "scheduled" : "queued",
      createdAt: new Date().toISOString(),
      startsAt: schedule.startsAt,
      establishmentName: payload.establishmentName,
      promoCode: payload.promoCode,
      offerBody: payload.offerBody,
      mediaType: payload.mediaType ?? null,
      mediaUrl: payload.mediaUrl || null,
      mediaCaption: payload.mediaCaption || null,
      ctaUrl,
      ctaLabel: payload.ctaLabel,
      discountLabel: payload.discountLabel,
    };
    const extras = await readDemoCreated();
    await writeDemoCreated([campaign, ...extras]);
    return {
      demo: true as const,
      campaign,
      recipients: recipients.length,
      message: successMessage,
    };
  }

  if (!isRedisConfigured()) {
    await releaseCampaignQuota({ restaurantId, leads: recipients.length }).catch(() => undefined);
    throw new Error("REDIS_URL é obrigatório para disparar campanhas.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    await releaseCampaignQuota({ restaurantId, leads: recipients.length }).catch(() => undefined);
    throw new Error("Supabase admin indisponível.");
  }

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      restaurant_id: restaurantId,
      name: payload.name,
      segment: payload.segment,
      template_name: payload.templateName,
      template_language: payload.templateLanguage,
      status,
      starts_at: schedule.startsAt,
      establishment_name: payload.establishmentName,
      promo_code: payload.promoCode,
      offer_body: payload.offerBody,
      media_type: payload.mediaType ?? null,
      media_url: payload.mediaUrl || null,
      media_caption: payload.mediaCaption || null,
      cta_url: ctaUrl,
      cta_label: payload.ctaLabel,
      discount_label: payload.discountLabel,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    await releaseCampaignQuota({ restaurantId, leads: recipients.length }).catch(() => undefined);
    throw campaignError ?? new Error("Falha ao criar campanha");
  }

  try {
    const queue = getCampaignSendQueue();
    const bulk: Array<{
      name: string;
      data: CampaignSendJob;
      opts: { jobId: string; delay?: number };
    }> = [];

    for (const customer of recipients) {
      const code = generateCouponCode(campaign.id, customer.id);
      const { data: coupon, error: couponError } = await admin
        .from("coupons")
        .insert({
          restaurant_id: restaurantId,
          campaign_id: campaign.id,
          customer_id: customer.id,
          code,
          discount_label: payload.discountLabel,
          status: "issued",
        })
        .select("id, code")
        .single();

      if (couponError || !coupon) throw couponError ?? new Error("Falha ao gerar cupom");

      const { data: job, error: jobError } = await admin
        .from("campaign_jobs")
        .insert({
          campaign_id: campaign.id,
          restaurant_id: restaurantId,
          customer_id: customer.id,
          coupon_id: coupon.id,
          status: "queued",
          scheduled_at: schedule.startsAt ?? new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobError || !job) throw jobError ?? new Error("Falha ao criar job");

      bulk.push({
        name: "marketing",
        data: {
          campaignId: campaign.id,
          campaignJobId: job.id,
          restaurantId,
          customerId: customer.id,
          customerPhone: customer.phone,
          customerName: customerFirstName(customer.name),
          templateName: payload.templateName,
          templateLanguage: payload.templateLanguage ?? DEFAULT_CAMPAIGN_TEMPLATE.language,
          establishmentName: payload.establishmentName,
          ctaUrl,
          couponCode: coupon.code,
        },
        opts: {
          jobId: job.id,
          ...(schedule.delayMs > 0 ? { delay: schedule.delayMs } : {}),
        },
      });
    }

    await queue.addBulk(bulk);

    if (!schedule.scheduled) {
      await admin
        .from("campaigns")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }

    return {
      demo: false as const,
      campaignId: campaign.id,
      recipients: recipients.length,
      message: successMessage,
    };
  } catch (error) {
    await releaseCampaignQuota({
      restaurantId,
      leads: recipients.length,
      campaignId: campaign.id,
    }).catch(() => undefined);
    throw error;
  }
}

export async function setCampaignStatus(campaignId: string, status: "paused" | "running") {
  if (isDemoMode()) {
    return { demo: true, status };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const restaurantId = await getCurrentRestaurantId();
  const patch =
    status === "paused"
      ? { status, paused_at: new Date().toISOString() }
      : { status, paused_at: null };

  const { data, error } = await admin
    .from("campaigns")
    .update(patch)
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Campanha não encontrada nesta loja.");

  return { demo: false, status };
}
